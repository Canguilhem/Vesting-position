## Linear checkpoint vesting — PASS

> incremental claims at each point through the linear window; 10% cliff at cliff_end, remainder vests linearly to end

### claim at each linear checkpoint

- [x] cumulative at 0% linear: `"100,000"`
- [x] cumulative at 1% linear: `"109,000"`
- [x] cumulative at 7% linear: `"163,000"`
- [x] cumulative at 13% linear: `"217,000"`
- [x] cumulative at 20% linear: `"280,000"`
- [x] cumulative at 33% linear: `"397,000"`
- [x] cumulative at 45% linear: `"505,000"`
- [x] cumulative at 50% linear: `"550,000"`
- [x] cumulative at 57% linear: `"613,000"`
- [x] cumulative at 67% linear: `"703,000"`
- [x] cumulative at 75% linear: `"775,000"`
- [x] cumulative at 83% linear: `"847,000"`
- [x] cumulative at 91% linear: `"919,000"`
- [x] cumulative at 99% linear: `"991,000"`
- [x] cumulative at 100% linear: `"1,000,000"`

**vested / released at linear checkpoints**

| linear % | timestamp (unix) | incremental release | cumulative released | expected cumulative |
|---|---|---|---|---|
| 0 | 1700172800 | 100,000 | 100,000 | 100,000 |
| 1 | 1700197856 | 9,000 | 109,000 | 109,000 |
| 7 | 1700348192 | 54,000 | 163,000 | 163,000 |
| 13 | 1700498528 | 54,000 | 217,000 | 217,000 |
| 20 | 1700673920 | 63,000 | 280,000 | 280,000 |
| 33 | 1700999648 | 117,000 | 397,000 | 397,000 |
| 45 | 1701300320 | 108,000 | 505,000 | 505,000 |
| 50 | 1701425600 | 45,000 | 550,000 | 550,000 |
| 57 | 1701600992 | 63,000 | 613,000 | 613,000 |
| 67 | 1701851552 | 90,000 | 703,000 | 703,000 |
| 75 | 1702052000 | 72,000 | 775,000 | 775,000 |
| 83 | 1702252448 | 72,000 | 847,000 | 847,000 |
| 91 | 1702452896 | 72,000 | 919,000 | 919,000 |
| 99 | 1702653344 | 72,000 | 991,000 | 991,000 |
| 100 | 1702678400 | 9,000 | 1,000,000 | 1,000,000 |

- [x] full allocation released at end: `"1,000,000"`
