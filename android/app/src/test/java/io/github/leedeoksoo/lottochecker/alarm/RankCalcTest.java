package io.github.leedeoksoo.lottochecker.alarm;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class RankCalcTest {

    private static final int[] WIN = {3, 14, 22, 30, 41, 45};
    private static final int BONUS = 7;

    private static int rank(int... pick) {
        return RankCalc.rank(pick, WIN, BONUS);
    }

    @Test
    public void first() {
        assertEquals(1, rank(45, 41, 30, 22, 14, 3));
    }

    @Test
    public void secondNeedsBonus() {
        assertEquals(2, rank(3, 14, 22, 30, 41, 7));
    }

    @Test
    public void third() {
        assertEquals(3, rank(3, 14, 22, 30, 41, 8));
    }

    @Test
    public void fourthAndFifth() {
        assertEquals(4, rank(3, 14, 22, 30, 1, 2));
        assertEquals(5, rank(3, 14, 22, 1, 2, 4));
    }

    @Test
    public void bonusAloneDoesNotCount() {
        assertEquals(0, rank(3, 14, 7, 1, 2, 4));
        // 4개 + 보너스는 그냥 4등
        assertEquals(4, rank(3, 14, 22, 30, 7, 1));
    }

    @Test
    public void miss() {
        assertEquals(0, rank(1, 2, 4, 5, 6, 8));
    }
}
