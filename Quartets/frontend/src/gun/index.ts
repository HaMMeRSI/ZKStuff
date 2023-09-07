import Gun from 'gun/gun';
// import SEA from 'gun/sea.js';
import 'gun/lib/radix';
import 'gun/lib/radisk';
import 'gun/lib/store';
import 'gun/lib/rindexed';
import 'gun/lib/webrtc';

// export const gun = Gun({ peers: ['http://localhost:8000/gun','https://gun-manhattan.herokuapp.com/gun'], localStorage: false });
export const gun = Gun({ peers: ['http://localhost:8000/gun'],  });
