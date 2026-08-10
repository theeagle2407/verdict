//!
//! VERDICT — AI-refereed escrow on Arbitrum Stylus.
//!
//! Two parties lock funds against agreed terms. When they disagree, either
//! party escalates to AI resolution; a designated resolver posts a split, and
//! the contract computes the settlement on-chain and pays both parties.
//!
//! Trust model: the resolver can ONLY set a split (worker's share in basis
//! points) between the two real parties. It can never redirect funds to
//! itself or a third party. Settlement math is fixed and on-chain.
//!

#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

#[macro_use]
extern crate alloc;

use alloc::vec::Vec;

use stylus_sdk::{
    alloy_primitives::{Address, B256, U256},
    alloy_sol_types::sol,
    prelude::*,
    stylus_core::log,
};

// Lifecycle states, as U256 to match uint256 storage.
fn st_funded() -> U256 { U256::from(1) }
fn st_disputed() -> U256 { U256::from(2) }
fn st_ruled() -> U256 { U256::from(3) }
fn st_settled() -> U256 { U256::from(4) }

// Events for the frontend / judges to watch.
sol! {
    event EscrowCreated(uint256 indexed id, address indexed client, address indexed worker, uint256 amount);
    event ResolutionRequested(uint256 indexed id, address indexed requester);
    event RulingSubmitted(uint256 indexed id, uint256 workerBps, bytes32 rulingRef);
    event Settled(uint256 indexed id, uint256 workerCut, uint256 clientCut);
}

#[derive(SolidityError)]
pub enum Error {
    ZeroAmount(ZeroAmount),
    ZeroWorker(ZeroWorker),
    SelfDeal(SelfDeal),
    NotParty(NotParty),
    NotResolver(NotResolver),
    BadState(BadState),
    BpsOutOfRange(BpsOutOfRange),
    AlreadyInit(AlreadyInit),
    TransferFailed(TransferFailed),
}

sol! {
    error ZeroAmount();
    error ZeroWorker();
    error SelfDeal();
    error NotParty();
    error NotResolver();
    error BadState();
    error BpsOutOfRange();
    error AlreadyInit();
    error TransferFailed();
}

sol_storage! {
    #[entrypoint]
    pub struct Verdict {
        address resolver;
        uint256 next_id;
        mapping(uint256 => address) client;
        mapping(uint256 => address) worker;
        mapping(uint256 => uint256) amount;
        mapping(uint256 => uint256) state;
        mapping(uint256 => bytes32) terms_hash;
        mapping(uint256 => uint256) requested_by; // 0 none, 1 client, 2 worker
        mapping(uint256 => uint256) worker_bps;
        mapping(uint256 => bytes32) ruling_ref;
    }
}

#[public]
impl Verdict {
    #[constructor]
    pub fn constructor(&mut self, resolver: Address) -> Result<(), Error> {
        if self.resolver.get() != Address::ZERO {
            return Err(Error::AlreadyInit(AlreadyInit {}));
        }
        if resolver == Address::ZERO {
            return Err(Error::ZeroWorker(ZeroWorker {}));
        }
        self.resolver.set(resolver);
        Ok(())
    }

    /// Client opens an escrow, locking msg_value against a worker + terms.
    #[payable]
    pub fn create_escrow(
        &mut self,
        worker: Address,
        terms_hash: B256,
    ) -> Result<U256, Error> {
        let value = self.vm().msg_value();
        if value == U256::ZERO {
            return Err(Error::ZeroAmount(ZeroAmount {}));
        }
        if worker == Address::ZERO {
            return Err(Error::ZeroWorker(ZeroWorker {}));
        }
        let sender = self.vm().msg_sender();
        if worker == sender {
            return Err(Error::SelfDeal(SelfDeal {}));
        }

        let id = self.next_id.get();
        self.next_id.set(id + U256::from(1));

        self.client.insert(id, sender);
        self.worker.insert(id, worker);
        self.amount.insert(id, value);
        self.state.insert(id, st_funded());
        self.terms_hash.insert(id, terms_hash);
        self.requested_by.insert(id, U256::ZERO);

        log(
            self.vm(),
            EscrowCreated {
                id,
                client: sender,
                worker,
                amount: value,
            },
        );
        Ok(id)
    }

    /// Either party escalates to AI resolution. Records who asked.
    pub fn request_resolution(&mut self, id: U256) -> Result<(), Error> {
        if self.state.get(id) != st_funded() {
            return Err(Error::BadState(BadState {}));
        }
        let sender = self.vm().msg_sender();
        let who = if sender == self.client.get(id) {
            U256::from(1)
        } else if sender == self.worker.get(id) {
            U256::from(2)
        } else {
            return Err(Error::NotParty(NotParty {}));
        };
        self.state.insert(id, st_disputed());
        self.requested_by.insert(id, who);

        log(
            self.vm(),
            ResolutionRequested {
                id,
                requester: sender,
            },
        );
        Ok(())
    }

    /// Resolver posts the AI ruling: worker share in basis points (0..=10000).
    pub fn submit_ruling(
        &mut self,
        id: U256,
        worker_bps: U256,
        ruling_ref: B256,
    ) -> Result<(), Error> {
        if self.vm().msg_sender() != self.resolver.get() {
            return Err(Error::NotResolver(NotResolver {}));
        }
        if self.state.get(id) != st_disputed() {
            return Err(Error::BadState(BadState {}));
        }
        if worker_bps > U256::from(10000) {
            return Err(Error::BpsOutOfRange(BpsOutOfRange {}));
        }
        self.worker_bps.insert(id, worker_bps);
        self.ruling_ref.insert(id, ruling_ref);
        self.state.insert(id, st_ruled());

        log(
            self.vm(),
            RulingSubmitted {
                id,
                workerBps: worker_bps,
                rulingRef: ruling_ref,
            },
        );
        Ok(())
    }

    /// Anyone can trigger settlement once a ruling exists.
    /// On-chain settlement math: split the locked amount by basis points.
    pub fn settle(&mut self, id: U256) -> Result<(), Error> {
        if self.state.get(id) != st_ruled() {
            return Err(Error::BadState(BadState {}));
        }
        let bps = self.worker_bps.get(id);
        let total = self.amount.get(id);
        let worker_cut = total * bps / U256::from(10000);
        let client_cut = total - worker_cut;

        let worker_addr = self.worker.get(id);
        let client_addr = self.client.get(id);

        // Checks-effects-interactions: mark settled before transfers.
        self.state.insert(id, st_settled());
        self.amount.insert(id, U256::ZERO);

        if worker_cut > U256::ZERO {
            self.vm()
                .transfer_eth(worker_addr, worker_cut)
                .map_err(|_| Error::TransferFailed(TransferFailed {}))?;
        }
        if client_cut > U256::ZERO {
            self.vm()
                .transfer_eth(client_addr, client_cut)
                .map_err(|_| Error::TransferFailed(TransferFailed {}))?;
        }

        log(
            self.vm(),
            Settled {
                id,
                workerCut: worker_cut,
                clientCut: client_cut,
            },
        );
        Ok(())
    }

    // ---- views ----

    pub fn get_resolver(&self) -> Address {
        self.resolver.get()
    }

    pub fn total_escrows(&self) -> U256 {
        self.next_id.get()
    }

    pub fn get_escrow(
        &self,
        id: U256,
    ) -> (Address, Address, U256, U256, U256, U256) {
        (
            self.client.get(id),
            self.worker.get(id),
            self.amount.get(id),
            self.state.get(id),
            self.requested_by.get(id),
            self.worker_bps.get(id),
        )
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use stylus_sdk::testing::*;

    #[test]
    fn test_escrow_lifecycle() {
        let vm = TestVM::default();
        let mut c = Verdict::from(&vm);

        let resolver = Address::from([9u8; 20]);
        let _ = c.constructor(resolver);
        assert_eq!(c.get_resolver(), resolver);

        let worker = Address::from([2u8; 20]);
        vm.set_value(U256::from(1000));
        let id = c.create_escrow(worker, B256::ZERO).unwrap();
        assert_eq!(id, U256::ZERO);
        assert_eq!(c.total_escrows(), U256::from(1));

        let _ = c.request_resolution(id);

        vm.set_sender(resolver);
        let _ = c.submit_ruling(id, U256::from(7000), B256::ZERO);

        let _ = c.settle(id);
        let (_, _, amount, state, _, bps) = c.get_escrow(id);
        assert_eq!(state, U256::from(4));
        assert_eq!(bps, U256::from(7000));
        assert_eq!(amount, U256::ZERO);
    }
}
