package io.github.leedeoksoo.lottochecker.alarm;

/** 등수 계산. 웹의 LottoHistoryChecker.jsx 와 같은 규칙이다. */
public final class RankCalc {

    private RankCalc() {}

    /** 1~5등, 낙첨이면 0. */
    public static int rank(int[] pick, int[] win, int bonus) {
        int matched = 0;
        boolean bonusHit = false;
        for (int p : pick) {
            for (int w : win) {
                if (p == w) {
                    matched++;
                    break;
                }
            }
            if (p == bonus) bonusHit = true;
        }
        if (matched == 6) return 1;
        if (matched == 5) return bonusHit ? 2 : 3;
        if (matched == 4) return 4;
        if (matched == 3) return 5;
        return 0;
    }
}
