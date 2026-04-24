#!/usr/bin/env python3
"""
SpicyPick App Store Screenshot Generator
Generates designed placeholder screenshots for App Store / Google Play submission.
Run: python3 scripts/generate-screenshots.py
Output: fastlane/screenshots/{ios,android}/en-US/
"""

import argparse
import os
import math
from PIL import Image, ImageDraw, ImageFont

# Brand colors
BG = "#1a1a2e"
BG_CARD = "#16213e"
BG_LIGHT = "#0f3460"
PRIMARY = "#e94560"
PRIMARY_DARK = "#c23152"
ACCENT = "#f5a623"
TEXT = "#ffffff"
TEXT_SEC = "#a0a0b8"
TEXT_MUTED = "#6b6b80"
GUILTY = "#e94560"
NOT_GUILTY = "#4ade80"
COMPLICATED = "#fbbf24"
BOTH_WRONG = "#8b5cf6"

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def draw_rounded_rect(draw, xy, radius, fill=None, outline=None, width=2):
    x0, y0, x1, y1 = xy
    fill_rgb = hex_to_rgb(fill) if fill else None
    outline_rgb = hex_to_rgb(outline) if outline else None
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill_rgb, outline=outline_rgb, width=width)

def create_base(w, h):
    img = Image.new("RGB", (w, h), color=hex_to_rgb(BG))
    draw = ImageDraw.Draw(img)
    return img, draw

def try_font(size):
    """Try to load a system font, fallback to default."""
    for path in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()

def try_font_regular(size):
    for path in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    ]:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()

def draw_status_bar(draw, w, scale=1.0):
    """Draw a fake status bar at top."""
    h = int(44 * scale)
    draw.rectangle([0, 0, w, h], fill=hex_to_rgb(BG))
    f = try_font_regular(int(14 * scale))
    draw.text((int(20 * scale), int(12 * scale)), "9:41", fill=hex_to_rgb(TEXT), font=f)
    draw.text((w - int(80 * scale), int(12 * scale)), "▌▌▌  WiFi  🔋", fill=hex_to_rgb(TEXT), font=f)

def draw_tab_bar(draw, w, h, active_idx, labels, scale=1.0):
    """Draw bottom tab bar."""
    bar_h = int(83 * scale)
    y0 = h - bar_h
    draw.rectangle([0, y0, w, h], fill=hex_to_rgb(BG_CARD))
    # Separator line
    draw.line([0, y0, w, y0], fill=hex_to_rgb(BG_LIGHT), width=1)
    tab_w = w // len(labels)
    icons = ["🔥", "🏆", "⚔️", "👤", "⚙️"]
    for i, label in enumerate(labels):
        cx = tab_w * i + tab_w // 2
        color = PRIMARY if i == active_idx else TEXT_MUTED
        f = try_font(int(10 * scale))
        # Icon area
        ic_y = y0 + int(12 * scale)
        draw.text((cx - int(8 * scale), ic_y), icons[i], fill=hex_to_rgb(color), font=try_font(int(20 * scale)))
        lbl_y = y0 + int(42 * scale)
        draw.text((cx - int(len(label)*3*scale), lbl_y), label, fill=hex_to_rgb(color), font=f)

def draw_header(draw, w, title, subtitle=None, scale=1.0):
    """Draw app header with logo."""
    y = int(60 * scale)
    f_title = try_font(int(22 * scale))
    f_sub = try_font_regular(int(14 * scale))
    # Logo dot
    draw.ellipse([int(20*scale), y, int(40*scale), y+int(20*scale)], fill=hex_to_rgb(PRIMARY))
    draw.text((int(50*scale), y), title, fill=hex_to_rgb(TEXT), font=f_title)
    if subtitle:
        draw.text((int(20*scale), y + int(32*scale)), subtitle, fill=hex_to_rgb(TEXT_SEC), font=f_sub)

def wrap_text(text, max_width, font, draw):
    """Wrap text to fit max_width."""
    words = text.split()
    lines = []
    current = []
    for word in words:
        test = ' '.join(current + [word])
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] > max_width and current:
            lines.append(' '.join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(' '.join(current))
    return lines

# ─── Screenshot 1: Daily Scenario ─────────────────────────────────────────────
def screenshot_daily_scenario(w, h):
    scale = w / 390.0
    img, draw = create_base(w, h)
    draw_status_bar(draw, w, scale)

    # Caption overlay at top
    cap_h = int(80 * scale)
    draw.rectangle([0, int(44*scale), w, int(44*scale) + cap_h], fill=hex_to_rgb(PRIMARY))
    f_cap = try_font(int(20 * scale))
    draw.text((int(w/2 - 120*scale), int(60*scale)), "Read. Vote. Compare 🗳️", fill=hex_to_rgb(TEXT), font=f_cap)

    y = int(160 * scale)

    # App header
    draw_header(draw, w, "SpicyPick", "Today's Scenario  •  Apr 24", scale)
    y = int(130 * scale)

    # Streak badge
    draw_rounded_rect(draw, [w-int(90*scale), int(58*scale), w-int(15*scale), int(90*scale)], int(12*scale), fill=BG_LIGHT)
    f_sm = try_font_regular(int(12*scale))
    draw.text((w-int(82*scale), int(66*scale)), "🔥 7 day streak", fill=hex_to_rgb(ACCENT), font=f_sm)

    # Scenario card
    card_y = y + int(20*scale)
    card_x = int(16*scale)
    card_w = w - int(32*scale)
    card_h_val = int(260*scale)
    draw_rounded_rect(draw, [card_x, card_y, card_x+card_w, card_y+card_h_val], int(16*scale), fill=BG_CARD)

    # Category tag
    tag_y = card_y + int(16*scale)
    draw_rounded_rect(draw, [card_x+int(16*scale), tag_y, card_x+int(110*scale), tag_y+int(24*scale)], int(12*scale), fill=BG_LIGHT)
    f_tag = try_font_regular(int(11*scale))
    draw.text((card_x+int(24*scale), tag_y+int(6*scale)), "🌶️ Spicy  •  Relationship", fill=hex_to_rgb(TEXT_SEC), font=f_tag)

    # Scenario title
    f_title = try_font(int(20*scale))
    f_body = try_font_regular(int(15*scale))
    title_y = tag_y + int(36*scale)
    draw.text((card_x+int(16*scale), title_y), "The Borrowed Car", fill=hex_to_rgb(TEXT), font=f_title)

    # Body text
    scenario = "Your best friend borrowed your car without asking while you were asleep, got a parking ticket, and didn't tell you until you found it in the mail. What's your verdict?"
    lines = wrap_text(scenario, card_w - int(32*scale), f_body, draw)
    body_y = title_y + int(32*scale)
    for line in lines[:5]:
        draw.text((card_x+int(16*scale), body_y), line, fill=hex_to_rgb(TEXT_SEC), font=f_body)
        body_y += int(22*scale)

    # Verdict options (4 buttons)
    verd_y = card_y + card_h_val + int(24*scale)
    verdicts = [
        ("😤 Guilty", GUILTY),
        ("😇 Not Guilty", NOT_GUILTY),
        ("🤔 It's Complicated", COMPLICATED),
        ("🚫 Both Wrong", BOTH_WRONG),
    ]
    btn_w = (w - int(48*scale)) // 2
    btn_h = int(56*scale)
    for i, (label, color) in enumerate(verdicts):
        col = i % 2
        row = i // 2
        bx = int(16*scale) + col * (btn_w + int(16*scale))
        by = verd_y + row * (btn_h + int(12*scale))
        draw_rounded_rect(draw, [bx, by, bx+btn_w, by+btn_h], int(12*scale), fill=color+"33")
        draw_rounded_rect(draw, [bx, by, bx+btn_w, by+btn_h], int(12*scale), outline=color, width=2)
        f_btn = try_font(int(14*scale))
        tw = draw.textbbox((0,0), label, font=f_btn)[2]
        draw.text((bx + (btn_w-tw)//2, by + int(20*scale)), label, fill=hex_to_rgb(color), font=f_btn)

    # Votes counter
    votes_y = verd_y + 2*(btn_h + int(12*scale)) + int(16*scale)
    f_votes = try_font_regular(int(13*scale))
    draw.text((int(w/2 - 60*scale), votes_y), "👥  12,847 votes so far", fill=hex_to_rgb(TEXT_MUTED), font=f_votes)

    draw_tab_bar(draw, w, h, 0, ["Today", "League", "Duels", "Profile", "Settings"], scale)
    return img

# ─── Screenshot 2: Vote Reveal / Community Results ────────────────────────────
def screenshot_vote_reveal(w, h):
    scale = w / 390.0
    img, draw = create_base(w, h)
    draw_status_bar(draw, w, scale)

    # Caption
    draw.rectangle([0, int(44*scale), w, int(44*scale)+int(80*scale)], fill=hex_to_rgb(PRIMARY))
    f_cap = try_font(int(20*scale))
    draw.text((int(w/2 - 130*scale), int(60*scale)), "See how millions voted 🌍", fill=hex_to_rgb(TEXT), font=f_cap)

    y = int(140*scale)
    draw_header(draw, w, "Community Results", None, scale)
    y = int(145*scale)

    # Verdict result card
    card_x = int(16*scale)
    card_w = w - int(32*scale)

    f_sec = try_font_regular(int(14*scale))
    draw.text((card_x, y), "The Borrowed Car", fill=hex_to_rgb(TEXT_SEC), font=f_sec)
    y += int(30*scale)

    # XP gain banner
    draw_rounded_rect(draw, [card_x, y, card_x+card_w, y+int(48*scale)], int(12*scale), fill=ACCENT+"22")
    draw_rounded_rect(draw, [card_x, y, card_x+card_w, y+int(48*scale)], int(12*scale), outline=ACCENT, width=2)
    f_xp = try_font(int(16*scale))
    draw.text((card_x+int(16*scale), y+int(14*scale)), "✨  You earned +25 XP for voting today!", fill=hex_to_rgb(ACCENT), font=f_xp)
    y += int(64*scale)

    # Bar chart
    verdicts = [
        ("😤 Guilty", 38, GUILTY),
        ("😇 Not Guilty", 28, NOT_GUILTY),
        ("🤔 It's Complicated", 24, COMPLICATED),
        ("🚫 Both Wrong", 10, BOTH_WRONG),
    ]
    bar_max_w = card_w - int(160*scale)
    for (label, pct, color) in verdicts:
        # Label
        f_lbl = try_font_regular(int(13*scale))
        draw.text((card_x, y+int(6*scale)), label, fill=hex_to_rgb(TEXT), font=f_lbl)
        # Bar
        bx = card_x + int(140*scale)
        by = y
        bar_w = int(bar_max_w * pct / 100)
        bar_h = int(28*scale)
        draw_rounded_rect(draw, [bx, by, bx+bar_w, by+bar_h], int(6*scale), fill=color+"88")
        # Percentage
        f_pct = try_font(int(13*scale))
        draw.text((bx+bar_w+int(8*scale), by+int(8*scale)), f"{pct}%", fill=hex_to_rgb(color), font=f_pct)
        y += int(44*scale)

    # Expert analysis teaser
    y += int(16*scale)
    draw_rounded_rect(draw, [card_x, y, card_x+card_w, y+int(100*scale)], int(12*scale), fill=BG_CARD)
    f_expert_hd = try_font(int(16*scale))
    draw.text((card_x+int(16*scale), y+int(14*scale)), "🎓 Expert Analysis", fill=hex_to_rgb(TEXT), font=f_expert_hd)
    f_expert = try_font_regular(int(13*scale))
    analysis = "From a relationship psychology perspective, borrowing without asking violates trust boundaries even if well-intentioned..."
    lines = wrap_text(analysis, card_w - int(32*scale), f_expert, draw)
    ey = y + int(40*scale)
    for line in lines[:2]:
        draw.text((card_x+int(16*scale), ey), line, fill=hex_to_rgb(TEXT_SEC), font=f_expert)
        ey += int(20*scale)
    # Premium lock
    f_lock = try_font_regular(int(12*scale))
    draw.text((card_x+int(16*scale), ey+int(6*scale)), "🔒 Unlock with Premium", fill=hex_to_rgb(ACCENT), font=f_lock)

    # Share button
    y += int(120*scale)
    draw_rounded_rect(draw, [card_x, y, card_x+card_w, y+int(52*scale)], int(12*scale), fill=PRIMARY)
    f_share = try_font(int(16*scale))
    share_text = "Share your verdict"
    tw = draw.textbbox((0,0), share_text, font=f_share)[2]
    draw.text((w//2 - tw//2, y+int(16*scale)), share_text, fill=hex_to_rgb(TEXT), font=f_share)

    draw_tab_bar(draw, w, h, 0, ["Today", "League", "Duels", "Profile", "Settings"], scale)
    return img

# ─── Screenshot 3: Weekly League ──────────────────────────────────────────────
def screenshot_league(w, h):
    scale = w / 390.0
    img, draw = create_base(w, h)
    draw_status_bar(draw, w, scale)

    # Caption
    draw.rectangle([0, int(44*scale), w, int(44*scale)+int(80*scale)], fill=hex_to_rgb(PRIMARY))
    f_cap = try_font(int(20*scale))
    draw.text((int(w/2 - 130*scale), int(60*scale)), "Climb the weekly ranks 🏆", fill=hex_to_rgb(TEXT), font=f_cap)

    draw_header(draw, w, "Weekly League", "Resets in 3d 14h 22m", scale)
    y = int(145*scale)

    # User position card
    card_x = int(16*scale)
    card_w = w - int(32*scale)
    draw_rounded_rect(draw, [card_x, y, card_x+card_w, y+int(70*scale)], int(14*scale), fill=PRIMARY+"33")
    draw_rounded_rect(draw, [card_x, y, card_x+card_w, y+int(70*scale)], int(14*scale), outline=PRIMARY, width=2)
    f_pos = try_font(int(22*scale))
    draw.text((card_x+int(16*scale), y+int(20*scale)), "#14", fill=hex_to_rgb(PRIMARY), font=f_pos)
    f_you = try_font_regular(int(14*scale))
    draw.text((card_x+int(70*scale), y+int(20*scale)), "Your position", fill=hex_to_rgb(TEXT), font=f_you)
    draw.text((card_x+int(70*scale), y+int(42*scale)), "1,240 XP  •  Silver II tier", fill=hex_to_rgb(TEXT_SEC), font=f_you)
    # Arrow up
    draw.text((card_x+card_w-int(40*scale), y+int(24*scale)), "↑ 3", fill=hex_to_rgb(NOT_GUILTY), font=f_you)
    y += int(86*scale)

    # Leaderboard
    players = [
        ("🥇", "NightOwl42",    "2,845 XP", "#ffd700", True),
        ("🥈", "SpicyJudge",    "2,712 XP", "#c0c0c0", False),
        ("🥉", "VerdictKing",   "2,580 XP", "#cd7f32", False),
        ("4.",  "MoralCompass", "2,340 XP", TEXT_MUTED, False),
        ("5.",  "JudgeMe",      "2,110 XP", TEXT_MUTED, False),
        ("...", "...",          "...",       TEXT_MUTED, False),
        ("14.", "You",          "1,240 XP", PRIMARY, True),
        ("15.", "LawStudent",   "1,190 XP", TEXT_MUTED, False),
    ]
    row_h = int(50*scale)
    for rank, name, xp, color, is_you in players:
        row_bg = BG_CARD if not is_you else BG_LIGHT
        draw_rounded_rect(draw, [card_x, y, card_x+card_w, y+row_h-int(4*scale)], int(8*scale), fill=row_bg)
        f_rank = try_font(int(16*scale))
        f_name = try_font_regular(int(14*scale))
        f_xp = try_font_regular(int(12*scale))
        draw.text((card_x+int(12*scale), y+int(14*scale)), rank, fill=hex_to_rgb(color), font=f_rank)
        draw.text((card_x+int(55*scale), y+int(14*scale)), name, fill=hex_to_rgb(TEXT if not is_you else PRIMARY), font=f_name)
        tw = draw.textbbox((0,0), xp, font=f_xp)[2]
        draw.text((card_x+card_w-tw-int(12*scale), y+int(18*scale)), xp, fill=hex_to_rgb(TEXT_SEC), font=f_xp)
        y += row_h

    draw_tab_bar(draw, w, h, 1, ["Today", "League", "Duels", "Profile", "Settings"], scale)
    return img

# ─── Screenshot 4: Profile & Achievements ─────────────────────────────────────
def screenshot_profile(w, h):
    scale = w / 390.0
    img, draw = create_base(w, h)
    draw_status_bar(draw, w, scale)

    # Caption
    draw.rectangle([0, int(44*scale), w, int(44*scale)+int(80*scale)], fill=hex_to_rgb(PRIMARY))
    f_cap = try_font(int(20*scale))
    draw.text((int(w/2 - 140*scale), int(60*scale)), "Earn achievements & streaks 🏅", fill=hex_to_rgb(TEXT), font=f_cap)

    y = int(140*scale)

    # Avatar + username
    av_r = int(44*scale)
    av_cx = int(w//2)
    av_cy = y + av_r
    draw.ellipse([av_cx-av_r, av_cy-av_r, av_cx+av_r, av_cy+av_r], fill=hex_to_rgb(PRIMARY_DARK))
    f_av = try_font(int(28*scale))
    draw.text((av_cx-int(16*scale), av_cy-int(18*scale)), "😎", fill=hex_to_rgb(TEXT), font=f_av)

    f_username = try_font(int(20*scale))
    uname = "NightOwl42"
    uw = draw.textbbox((0,0), uname, font=f_username)[2]
    draw.text((w//2 - uw//2, av_cy+av_r+int(12*scale)), uname, fill=hex_to_rgb(TEXT), font=f_username)

    f_sub = try_font_regular(int(13*scale))
    sub = "Level 12  •  Silver II"
    sw = draw.textbbox((0,0), sub, font=f_sub)[2]
    draw.text((w//2 - sw//2, av_cy+av_r+int(38*scale)), sub, fill=hex_to_rgb(TEXT_SEC), font=f_sub)

    y = av_cy + av_r + int(70*scale)

    # XP bar
    xp_x = int(32*scale)
    xp_w = w - int(64*scale)
    xp_h = int(12*scale)
    draw_rounded_rect(draw, [xp_x, y, xp_x+xp_w, y+xp_h], int(6*scale), fill=BG_CARD)
    draw_rounded_rect(draw, [xp_x, y, xp_x+int(xp_w*0.72), y+xp_h], int(6*scale), fill=PRIMARY)
    f_xp_lbl = try_font_regular(int(11*scale))
    draw.text((xp_x, y+int(18*scale)), "1,240 / 1,500 XP to Level 13", fill=hex_to_rgb(TEXT_MUTED), font=f_xp_lbl)
    y += int(48*scale)

    # Stats row
    stats = [("🔥 7", "Streak"), ("📊 312", "Votes"), ("🏆 #14", "Rank")]
    stat_w = w // 3
    for i, (val, lbl) in enumerate(stats):
        sx = i * stat_w
        draw_rounded_rect(draw, [sx+int(8*scale), y, sx+stat_w-int(8*scale), y+int(60*scale)], int(12*scale), fill=BG_CARD)
        f_sv = try_font(int(18*scale))
        f_sl = try_font_regular(int(11*scale))
        vw = draw.textbbox((0,0), val, font=f_sv)[2]
        lw = draw.textbbox((0,0), lbl, font=f_sl)[2]
        draw.text((sx+(stat_w-vw)//2, y+int(10*scale)), val, fill=hex_to_rgb(TEXT), font=f_sv)
        draw.text((sx+(stat_w-lw)//2, y+int(36*scale)), lbl, fill=hex_to_rgb(TEXT_SEC), font=f_sl)
    y += int(76*scale)

    # Achievements grid
    f_ach_hd = try_font(int(16*scale))
    draw.text((int(16*scale), y), "Achievements", fill=hex_to_rgb(TEXT), font=f_ach_hd)
    y += int(28*scale)

    badges = [
        ("🔥", "7-Day Streak", True),
        ("⚡", "Speed Voter", True),
        ("🎯", "Perfect Week", True),
        ("🏆", "Top 10", True),
        ("👑", "League Winner", False),
        ("🌍", "Global Voter", False),
        ("🎭", "All Verdicts", False),
        ("💎", "100 Votes", True),
        ("🌟", "Trending", False),
        ("🔮", "Oracle", False),
    ]
    badge_w = (w - int(32*scale)) // 5
    badge_h = int(64*scale)
    for i, (icon, name, earned) in enumerate(badges):
        col = i % 5
        row = i // 5
        bx = int(16*scale) + col * badge_w
        by = y + row * (badge_h + int(8*scale))
        color = BG_CARD if earned else BG
        outline = PRIMARY if earned else BG_LIGHT
        draw_rounded_rect(draw, [bx+int(2*scale), by, bx+badge_w-int(2*scale), by+badge_h-int(4*scale)], int(10*scale), fill=color, outline=outline, width=1)
        f_icon = try_font(int(20*scale))
        f_name_sm = try_font_regular(int(9*scale))
        ic_w = draw.textbbox((0,0), icon, font=f_icon)[2]
        draw.text((bx+(badge_w-ic_w)//2, by+int(4*scale)), icon, fill=hex_to_rgb(TEXT if earned else TEXT_MUTED), font=f_icon)
        nm_w = draw.textbbox((0,0), name[:8], font=f_name_sm)[2]
        draw.text((bx+(badge_w-nm_w)//2, by+int(42*scale)), name[:8], fill=hex_to_rgb(TEXT_SEC if earned else TEXT_MUTED), font=f_name_sm)
        if not earned:
            draw.text((bx+int(badge_w//2 - 6*scale), by+int(4*scale)), "🔒", fill=hex_to_rgb(TEXT_MUTED), font=try_font(int(16*scale)))

    draw_tab_bar(draw, w, h, 3, ["Today", "League", "Duels", "Profile", "Settings"], scale)
    return img

# ─── Screenshot 5: Premium / Archive ──────────────────────────────────────────
def screenshot_premium(w, h):
    scale = w / 390.0
    img, draw = create_base(w, h)
    draw_status_bar(draw, w, scale)

    # Caption
    draw.rectangle([0, int(44*scale), w, int(44*scale)+int(80*scale)], fill=hex_to_rgb(ACCENT))
    f_cap = try_font(int(20*scale))
    draw.text((int(w/2 - 155*scale), int(60*scale)), "Go premium: ad-free + archive ✨", fill=hex_to_rgb(BG), font=f_cap)

    draw_header(draw, w, "SpicyPick Premium", None, scale)
    y = int(140*scale)

    card_x = int(16*scale)
    card_w = w - int(32*scale)

    # Premium hero
    draw_rounded_rect(draw, [card_x, y, card_x+card_w, y+int(140*scale)], int(16*scale), fill=BG_CARD)
    # Gradient-like shimmer
    for i in range(8):
        alpha = int(40 - i*4)
        draw.rectangle([card_x, y+i*int(3*scale), card_x+card_w, y+i*int(3*scale)+int(3*scale)], fill=(*hex_to_rgb(ACCENT), alpha))

    f_crown = try_font(int(36*scale))
    draw.text((w//2 - int(22*scale), y+int(16*scale)), "👑", fill=hex_to_rgb(ACCENT), font=f_crown)
    f_prem = try_font(int(22*scale))
    prem = "Premium"
    pw = draw.textbbox((0,0), prem, font=f_prem)[2]
    draw.text((w//2 - pw//2, y+int(60*scale)), prem, fill=hex_to_rgb(ACCENT), font=f_prem)
    f_price = try_font_regular(int(14*scale))
    price = "$3.99 / month  •  Cancel anytime"
    prw = draw.textbbox((0,0), price, font=f_price)[2]
    draw.text((w//2 - prw//2, y+int(90*scale)), price, fill=hex_to_rgb(TEXT_SEC), font=f_price)

    # CTA
    draw_rounded_rect(draw, [card_x+int(40*scale), y+int(110*scale), card_x+card_w-int(40*scale), y+int(136*scale)], int(10*scale), fill=ACCENT)
    f_cta = try_font(int(14*scale))
    cta = "Start 7-day free trial"
    cw = draw.textbbox((0,0), cta, font=f_cta)[2]
    draw.text((w//2-cw//2, y+int(118*scale)), cta, fill=hex_to_rgb(BG), font=f_cta)
    y += int(156*scale)

    # Features list
    features = [
        ("📚", "Scenario Archive", "Browse all past scenarios"),
        ("🚫", "Ad-Free",          "Zero interruptions"),
        ("🎓", "Expert Analysis",  "Full expert breakdowns"),
        ("📊", "Advanced Stats",   "Detailed voting analytics"),
        ("🌍", "All Languages",    "7 language packs"),
    ]
    for icon, title, desc in features:
        draw_rounded_rect(draw, [card_x, y, card_x+card_w, y+int(52*scale)], int(10*scale), fill=BG_CARD)
        f_icon = try_font(int(22*scale))
        f_ft = try_font(int(14*scale))
        f_fd = try_font_regular(int(12*scale))
        draw.text((card_x+int(12*scale), y+int(14*scale)), icon, fill=hex_to_rgb(TEXT), font=f_icon)
        draw.text((card_x+int(50*scale), y+int(10*scale)), title, fill=hex_to_rgb(TEXT), font=f_ft)
        draw.text((card_x+int(50*scale), y+int(30*scale)), desc, fill=hex_to_rgb(TEXT_SEC), font=f_fd)
        # Check
        draw.text((card_x+card_w-int(30*scale), y+int(16*scale)), "✓", fill=hex_to_rgb(NOT_GUILTY), font=f_ft)
        y += int(60*scale)

    draw_tab_bar(draw, w, h, 3, ["Today", "League", "Duels", "Profile", "Settings"], scale)
    return img

# ─── Sizes config ──────────────────────────────────────────────────────────────
SCREENSHOTS = [
    ("01_daily_scenario",   screenshot_daily_scenario),
    ("02_vote_reveal",      screenshot_vote_reveal),
    ("03_league",           screenshot_league),
    ("04_profile",          screenshot_profile),
    ("05_premium",          screenshot_premium),
]

IOS_SIZES = {
    "6.7inch": (1290, 2796),   # iPhone 16 / 15 Pro Max — required
    "5.5inch": (1242, 2208),   # iPhone 8 Plus — required for legacy
}

ANDROID_DIRS = {
    "phoneScreenshots": (1080, 1920),
    "sevenInchScreenshots": (1200, 1920),
}

def save_screenshot(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG")
    size_kb = os.path.getsize(path) // 1024
    print(f"  ✓ {path}  ({img.size[0]}×{img.size[1]}, {size_kb} KB)")

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def main():
    parser = argparse.ArgumentParser(description="SpicyPick Screenshot Generator")
    parser.add_argument("--locale", default="en-US", help="Locale code (e.g. en-US, cs)")
    args = parser.parse_args()
    locales = [args.locale]

    print("\n📸 SpicyPick Screenshot Generator")
    print("=" * 50)

    for locale in locales:
        print(f"\n── iOS {locale}")
        for size_name, (w, h) in IOS_SIZES.items():
            for slug, fn in SCREENSHOTS:
                img = fn(w, h)
                path = os.path.join(BASE, "fastlane", "screenshots", "ios", locale, f"{size_name}_{slug}.png")
                save_screenshot(img, path)

        print(f"\n── Android {locale}")
        for subdir, (w, h) in ANDROID_DIRS.items():
            for slug, fn in SCREENSHOTS:
                img = fn(w, h)
                path = os.path.join(BASE, "fastlane", "screenshots", "android", locale, subdir, f"{slug}.png")
                save_screenshot(img, path)

    print(f"\n✅ Done! Screenshots saved to fastlane/screenshots/")
    for locale in locales:
        print(f"   iOS:     fastlane/screenshots/ios/{locale}/")
        print(f"   Android: fastlane/screenshots/android/{locale}/")

if __name__ == "__main__":
    main()
