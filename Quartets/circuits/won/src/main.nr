use dep::std;

fn main(hand: [Field; 32], handHash: pub Field, card: pub u8, cardsPerSymbol: pub u8) {
    let hash = std::hash::pedersen(hand);
    let mut count = 0;

    assert(card > 0);
    assert(card < cardsPerSymbol * 4 + 1);
    assert(handHash == hash[0]);

    for i in 0..32 {
        let currCard = hand[i] as u8;

        if currCard % cardsPerSymbol == card {
            count = count + 1;
        }

        if(i as u8 >= 4) {
            assert(currCard == 0);
        }
    }
}

#[test]
fn test_main() {
    let hand = [1, 14, 27, 40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let handHash = 0x11a8621e7e45b6c13e008db61bcc54bfd70a11733f47abc387b3882b08c3c706;
    
    main(hand, handHash, 1, 13);
}

#[test]
fn test_main_3() {
    let hand = [1, 4, 7, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let handHash = 0x25d25841a67b3261107daea2ad9ded702f5751658dd2e89a0d81b25e520799ba;
    
    main(hand, handHash, 1, 3);
}
