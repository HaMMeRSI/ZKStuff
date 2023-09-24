use dep::std;

fn main(hand: [u8; 32], handHash: pub [u8; 32], card: pub u8) {
    let hash = std::hash::blake2s(hand);
    let mut found = false;
    
    // std::println(hash);

    assert(card > 0);
    assert(card < 54);
    assert(hash == handHash);
    
    for i in 0..32 {
        if hand[i] == card {
            found = true;
        }
    }

    assert(!found);
}

#[test]
fn test_main() {
    let hand = [3, 4, 1, 2, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let handHash = [54, 238, 82, 11, 108, 68, 186, 108, 12, 242, 71, 39, 15, 236, 24, 186, 59, 108, 253, 246, 138, 4, 122, 197, 38, 129, 45, 75, 201, 185, 107, 199];
    
    main(hand, handHash, 32);
}
#[test]
fn test_0() {
    let hand = [3, 4, 1, 2, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let handHash = [54, 238, 82, 11, 108, 68, 186, 108, 12, 242, 71, 39, 15, 236, 24, 186, 59, 108, 253, 246, 138, 4, 122, 197, 38, 129, 45, 75, 201, 185, 107, 199];
    main(hand, handHash, 0);
}
