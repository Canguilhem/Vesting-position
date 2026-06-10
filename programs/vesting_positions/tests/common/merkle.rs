use std::{collections::HashMap, fs, path::Path};

use anchor_lang::prelude::Pubkey;
use serde::Deserialize;
use serde_json::Value;

pub const GENERATED_MERKLE: &str = "tests/fixtures/merkle_proofs.json";
pub const MOCK_ALLOC: u64 = 1_000_000_000_000;
pub const TOTAL_DEPOSIT: u64 = 10 * MOCK_ALLOC;

#[derive(Clone)]
pub struct MerkleTree {
    pub root: [u8; 32],
    data: HashMap<String, Vec<Entry>>,
}

#[derive(Clone, Deserialize)]
struct Entry {
    amount: String,
    proofs: Vec<String>,
}

pub fn default_fixture() -> MerkleTree {
    load_merkle_data(GENERATED_MERKLE)
}

pub fn load_merkle_data(path: impl AsRef<Path>) -> MerkleTree {
    let raw: Value = serde_json::from_str(&fs::read_to_string(path.as_ref()).unwrap()).unwrap();

    let root_hex = raw["merkleRoot"].as_str().expect("merkleRoot");
    let root = hex32(root_hex);

    let mut data = HashMap::new();
    if let Value::Object(map) = raw {
        for (k, v) in map {
            if k == "merkleRoot" {
                continue;
            }
            let entries: Vec<Entry> = serde_json::from_value(v).unwrap();
            data.insert(k.to_lowercase(), entries);
        }
    }

    MerkleTree { root, data }
}

/// Look up `(allocation, proofs)` for a claimer pubkey.
pub fn get_proofs(fixture: &MerkleTree, claimer: &Pubkey) -> Option<(u64, Vec<[u8; 33]>)> {
    let key = claimer.to_string().to_lowercase();
    let entry = fixture.data.get(&key)?.first()?;
    let allocation = entry.amount.parse().ok()?;
    let proofs = entry.proofs.iter().map(|p| parse_proof_hex(p)).collect();
    Some((allocation, proofs))
}

/// Random invalid proofs for negative tests.
pub fn random_proofs() -> Vec<[u8; 33]> {
    vec![[1u8; 33], [2u8; 33]]
}

fn parse_proof_hex(s: &str) -> [u8; 33] {
    let hex = s.strip_prefix("0x").unwrap_or(s);
    let bytes: Vec<u8> = (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap())
        .collect();
    bytes.try_into().expect("proof must be 33 bytes")
}

fn hex32(hex: &str) -> [u8; 32] {
    let bytes: Vec<u8> = (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap())
        .collect();
    bytes.try_into().expect("root must be 32 bytes")
}
