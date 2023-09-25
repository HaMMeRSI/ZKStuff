use dep::std;

fn main(hand: [Field; 32], handHash: pub [Field; 1], card: pub u8, cardsPerSymbol: pub u8) {
    let hash = std::hash::pedersen(hand);
    let mut count = 0;

    assert(card > 0);
    assert(card < cardsPerSymbol * 4 + 1);
    assert(handHash[0] == hash[0]);

    for i in 0..32 {
        let currCard = hand[i] as u8;

        if currCard % cardsPerSymbol == card {
            count = count + 1;
        }
    }

    assert(count == 4);
}

#[test]
fn test_main() {
    let hand = [3, 4, 1, 2, 5, 6, 14, 27, 40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let handHash = [0x2ef937b57309bf4821d7cc177c2e5d8078248425e137c42d0464111aa6170974];
    
    main(hand, handHash, 1, 13);
}

#[test]
fn test_main_3() {
    let hand = [1, 4, 7, 10, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let handHash = [0x2a4dec06d7e0fd944817c5bf476ac722976e73486f3842f0bb05554c5cc36ccd];
    
    main(hand, handHash, 1, 3);
}
