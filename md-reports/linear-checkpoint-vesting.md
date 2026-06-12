## Linear checkpoint vesting — PASS

> incremental claims at each point through the linear window; 10% cliff at cliff_end, remainder vests linearly to end

### claim at each linear checkpoint

- [x] cumulative at 0% linear: `100000000000`
- [x] cumulative at 1% linear: `109000000000`
- [x] cumulative at 7% linear: `163000000000`
- [x] cumulative at 13% linear: `217000000000`
- [x] cumulative at 20% linear: `280000000000`
- [x] cumulative at 33% linear: `397000000000`
- [x] cumulative at 45% linear: `505000000000`
- [x] cumulative at 50% linear: `550000000000`
- [x] cumulative at 57% linear: `613000000000`
- [x] cumulative at 67% linear: `703000000000`
- [x] cumulative at 75% linear: `775000000000`
- [x] cumulative at 83% linear: `847000000000`
- [x] cumulative at 91% linear: `919000000000`
- [x] cumulative at 99% linear: `991000000000`
- [x] cumulative at 100% linear: `1000000000000`

**vested / released at linear checkpoints**

| linear % | timestamp (unix) | incremental release | cumulative released | expected cumulative |
|---|---|---|---|---|
| 0 | 1700172800 | 100000000000 | 100000000000 | 100000000000 |
| 1 | 1700197856 | 9000000000 | 109000000000 | 109000000000 |
| 7 | 1700348192 | 54000000000 | 163000000000 | 163000000000 |
| 13 | 1700498528 | 54000000000 | 217000000000 | 217000000000 |
| 20 | 1700673920 | 63000000000 | 280000000000 | 280000000000 |
| 33 | 1700999648 | 117000000000 | 397000000000 | 397000000000 |
| 45 | 1701300320 | 108000000000 | 505000000000 | 505000000000 |
| 50 | 1701425600 | 45000000000 | 550000000000 | 550000000000 |
| 57 | 1701600992 | 63000000000 | 613000000000 | 613000000000 |
| 67 | 1701851552 | 90000000000 | 703000000000 | 703000000000 |
| 75 | 1702052000 | 72000000000 | 775000000000 | 775000000000 |
| 83 | 1702252448 | 72000000000 | 847000000000 | 847000000000 |
| 91 | 1702452896 | 72000000000 | 919000000000 | 919000000000 |
| 99 | 1702653344 | 72000000000 | 991000000000 | 991000000000 |
| 100 | 1702678400 | 9000000000 | 1000000000000 | 1000000000000 |

- [x] full allocation released at end: `1000000000000`
