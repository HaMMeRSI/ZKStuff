use dep::std::{println};

fn modPowLong(b: u8, e: u8, m: u8) -> u8 {
	assert(m > 1);

	let mut c = 1;
    for i in 0..255 {
        if(i < e) {
            c = (c * b) % m;
        }
    }

    c as u8
}

fn bitsToU8(bits: [bool; 8]) -> u8 {
    let mut res = 0;
    let toDig = |b: bool| if b { 1 } else { 0 };

    for i in 0..8 {
        res =res* 2 + toDig(bits[i]);
    }

    res
}

fn modPow3(base: u8, exponent: u8, m: u8) -> u8 {
	assert(m > 1);

	let mut c = 1;
	let mut b = base % m;
    let mut e = exponent;

	for _i in 0..8 {
        if(e > 0){
            if (e % 2 == 1) {
                let c1 = (c * b) % m;

                if(c1 > 0) {
                    c = c1;
                }
            }
            
            e = e >> 1;
            b = (b * b) % m;
        }
	}
	
    c
}

fn modpow4(base: u8, exponentBits:[bool; 8], modulo: u8) -> u8 {
    assert(modulo > 1);

	let mut result = 1;
	let mut b = base % modulo;

	for i in 0..8 {
        if (exponentBits[7 - i]) {
            let c1 = (result * b) % modulo;

            if(c1 > 0) {
                result = c1;
            }
        }
        
        b = (b * b) % modulo;
	}
	
    result
}

fn modPow(base: u16, exponent: u16, modulo: u16) -> u16 {
    assert(modulo > 1);

	let mut result = 1;
	let mut b = base % modulo;
    let mut e = exponent;

	for _i in 0..8 {
        if e % 2 == 1 {
            result = (result * b) % modulo;
        }

        e = e / 2;
        b = (b * b) % modulo;
	}
	
    result
}

#[test]
fn test_main() {   
    let b = 45; 
    let eb =  122;
    let m = 42; 
    
    let res = modPow(b, eb, m);
    assert(res == 9);
}

// #[test]
// fn test_main() {   
//     let eb =  [true, true, true, true, true, false, true, true]; //251
//     let b = 2; 
//     let m = 34; 
    
//     let res = modpow(b, eb, m);
//     assert(res == 8);
// }
