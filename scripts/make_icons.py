#!/usr/bin/env python3
"""
앱 아이콘 생성기 — PWA 아이콘과 안드로이드 런처 아이콘을 한 번에 만듭니다.

디자인: 어두운 바탕(로또 용지를 올려둔 책상색) 위에 공식 볼 색 노란 공,
그 안에 «대조» 를 뜻하는 체크 표시.

사용법
    python scripts/make_icons.py          # public/icons + android/.../res 갱신

Pillow 만 있으면 됩니다. 결과가 항상 같으므로 언제든 다시 돌려도 됩니다.
"""

import os
import sys

from PIL import Image, ImageDraw

DESK = (14, 20, 27, 255)  # #0E141B
BALL = (251, 196, 0, 255)  # #FBC400 — 1~10번 공 색
INK = (22, 32, 43, 255)  # #16202B

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SS = 4  # 안티에일리어싱용 확대 배율


def draw_icon(size, *, bg=True, ball_ratio=0.66, radius_ratio=0.22):
    """정사각 아이콘 한 장. ball_ratio 는 전체 대비 공 지름 비율."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if bg:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * radius_ratio), fill=DESK)

    r = s * ball_ratio / 2
    cx = cy = s / 2
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BALL)

    # 체크 표시 — 공 안쪽에 맞춰 그립니다.
    w = max(1, int(r * 0.26))
    p1 = (cx - r * 0.46, cy + r * 0.02)
    p2 = (cx - r * 0.12, cy + r * 0.40)
    p3 = (cx + r * 0.50, cy - r * 0.40)
    d.line([p1, p2, p3], fill=INK, width=w, joint="curve")
    for p in (p1, p2, p3):  # 끝을 둥글게
        d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=INK)

    return img.resize((size, size), Image.LANCZOS)


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG", optimize=True)
    print("  ", os.path.relpath(path, ROOT))


def main():
    print("PWA 아이콘")
    icons = os.path.join(ROOT, "public", "icons")
    save(draw_icon(192), os.path.join(icons, "icon-192.png"))
    save(draw_icon(512), os.path.join(icons, "icon-512.png"))
    # 마스커블: 어떤 모양으로 잘려도 살아남도록 공을 작게(안전영역 80%)
    save(draw_icon(512, ball_ratio=0.46, radius_ratio=0.5), os.path.join(icons, "maskable-512.png"))
    save(draw_icon(180, radius_ratio=0.0), os.path.join(icons, "apple-touch-icon.png"))
    save(draw_icon(32), os.path.join(ROOT, "public", "favicon.png"))

    res = os.path.join(ROOT, "android", "app", "src", "main", "res")
    if not os.path.isdir(res):
        print("\nandroid/ 프로젝트가 없어 런처 아이콘은 건너뜁니다. (npx cap add android 후 다시 실행)")
        return 0

    print("\n안드로이드 런처 아이콘")
    # 기본 런처 아이콘 (정사각 / 원형)
    for folder, px in [
        ("mipmap-mdpi", 48),
        ("mipmap-hdpi", 72),
        ("mipmap-xhdpi", 96),
        ("mipmap-xxhdpi", 144),
        ("mipmap-xxxhdpi", 192),
    ]:
        save(draw_icon(px), os.path.join(res, folder, "ic_launcher.png"))
        save(draw_icon(px, radius_ratio=0.5), os.path.join(res, folder, "ic_launcher_round.png"))
        # 적응형 아이콘 전경: 108dp 중 가운데 72dp 만 보이므로 공을 작게 그리고 배경은 비웁니다.
        fg = int(px * 108 / 48) if folder == "mipmap-mdpi" else int(px * 2.25)
        save(draw_icon(fg, bg=False, ball_ratio=0.42), os.path.join(res, folder, "ic_launcher_foreground.png"))

    # 적응형 아이콘 배경색
    values = os.path.join(res, "values")
    os.makedirs(values, exist_ok=True)
    with open(os.path.join(values, "ic_launcher_background.xml"), "w", encoding="utf-8") as f:
        f.write(
            '<?xml version="1.0" encoding="utf-8"?>\n'
            "<resources>\n"
            '    <color name="ic_launcher_background">#0E141B</color>\n'
            "</resources>\n"
        )
    print("   android/app/src/main/res/values/ic_launcher_background.xml")

    for folder in ("mipmap-anydpi-v26",):
        os.makedirs(os.path.join(res, folder), exist_ok=True)
        for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
            with open(os.path.join(res, folder, name), "w", encoding="utf-8") as f:
                f.write(
                    '<?xml version="1.0" encoding="utf-8"?>\n'
                    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
                    '    <background android:drawable="@color/ic_launcher_background"/>\n'
                    '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
                    '    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>\n'
                    "</adaptive-icon>\n"
                )
            print(f"   android/app/src/main/res/{folder}/{name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
