#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
生成一张「无缝、无水印」的深绿草地图，用于替换站点背景 site-bg.jpg。
核心保证：
  1. 基础明暗用整频次正弦波叠加 -> 天然以整图尺寸为周期 -> 左右/上下边缘无缝衔接。
  2. 草叶绘制采用「九宫格偏移」副本法 -> 跨越边界的草叶会在对侧补全 -> 无缝。
  3. 全部程序生成，无任何外部水印。
"""
import math
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W = H = 1536
SEED = 7
random.seed(SEED)
np.random.seed(SEED)

yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)


def tileable_noise(grid_n, octaves=1, seed_off=0):
    """无缝噪声：对随机小网格做「带环绕的双线性上采样」。
    由于坐标按 mod 网格尺寸环绕，结果以整图尺寸为周期 -> 像素级无缝。"""
    rng = np.random.default_rng(SEED + seed_off)
    field = np.zeros((H, W), dtype=np.float64)
    amp = 1.0
    total = 0.0
    for o in range(octaves):
        g = grid_n * (2 ** o)
        vals = rng.random((g, g))
        xpos = np.linspace(0, g, W, endpoint=False)
        ypos = np.linspace(0, g, H, endpoint=False)
        xi0 = np.floor(xpos).astype(int) % g
        xi1 = (xi0 + 1) % g
        yi0 = np.floor(ypos).astype(int) % g
        yi1 = (yi0 + 1) % g
        xf = (xpos - np.floor(xpos))[None, :]
        yf = (ypos - np.floor(ypos))[:, None]
        c00 = vals[np.ix_(yi0, xi0)]
        c10 = vals[np.ix_(yi0, xi1)]
        c01 = vals[np.ix_(yi1, xi0)]
        c11 = vals[np.ix_(yi1, xi1)]
        top = c00 * (1 - xf) + c10 * xf
        bot = c01 * (1 - xf) + c11 * xf
        field += amp * (top * (1 - yf) + bot * yf)
        total += amp
        amp *= 0.55
    return field / total


# ---------- 1. 基础底色（深绿，带无缝明暗起伏）----------
low = tileable_noise(6, 3, seed_off=11)        # 大尺度起伏
fine = tileable_noise(40, 2, seed_off=23)      # 中尺度纹理

dark = np.array([9, 31, 19], dtype=np.float64)
mid = np.array([24, 74, 42], dtype=np.float64)

t = 0.5 + 0.5 * low * 0.85          # 0..1 大尺度亮度
base = dark[:, None, None] + (mid - dark)[:, None, None] * t[None, :, :]
# 叠加中尺度细纹理（轻微明暗）
base += fine[None, :, :] * np.array([6, 12, 8])[:, None, None]
base = np.clip(base.transpose(1, 2, 0), 0, 255).astype(np.uint8)  # (H, W, 3)

base_img = Image.fromarray(base, "RGB").convert("RGBA")


def wrap_offsets(x0, y0, margin):
    """返回需要绘制副本的偏移列表（含中心）。
    关键：草叶朝上方生长，'穿出'某条边后必须在'对侧'补全，否则接缝处断裂。
      - 穿出左缘(x<0)  -> 在右侧(+W)补全
      - 穿出右缘(x>W)  -> 在左侧(-W)补全
      - 穿出上缘(y<0)  -> 在下方(+H)补全
      - 穿出下缘(y>H)  -> 在上方(-H)补全（本图草叶只朝上，极少触发，保留以防万一）
    """
    offs = [(0, 0)]
    if x0 < margin:
        offs += [(W, 0), (W, -H), (W, H)]
    if x0 > W - margin:
        offs += [(-W, 0), (-W, -H), (-W, H)]
    if y0 < margin:
        offs += [(0, H), (-W, H), (W, H)]
    if y0 > H - margin:
        offs += [(0, -H), (-W, -H), (W, -H)]
    return list(dict.fromkeys(offs))


def draw_blade(d, x0, y0, length, angle, bend, width, c_base, c_tip):
    steps = max(5, int(length / 2.5))
    for i in range(steps + 1):
        t_ = i / steps
        x = x0 + math.sin(angle) * length * t_ + bend * length * t_ * t_
        y = y0 - length * t_
        r = max(0.6, width * (1.0 - t_ * 0.8))
        a = int(255 * (1.0 - t_ * 0.12))
        c = tuple(int(c_base[k] + (c_tip[k] - c_base[k]) * t_) for k in range(3))
        d.ellipse([x - r, y - r, x + r, y + r], fill=c + (a,))


# ---------- 2. 柔光散景（氛围光斑，低透明度，先铺底）----------
bokeh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
bd = ImageDraw.Draw(bokeh)
for _ in range(70):
    r = random.uniform(40, 130)
    cx = random.uniform(0, W)
    cy = random.uniform(0, H)
    g = random.randint(70, 130)
    col = (g, g + 40, g + 20)
    a = random.randint(10, 26)
    for off in wrap_offsets(cx, cy, r + 4):
        ox, oy = off
        bd.ellipse([cx + ox - r, cy + oy - r, cx + ox + r, cy + oy + r], fill=col + (a,))
# 环绕模糊：在 3x3 平铺画布上模糊后取中心，保证光斑模糊也周期无缝
big = Image.new("RGBA", (W * 3, H * 3), (0, 0, 0, 0))
for dx in (-W, 0, W):
    for dy in (-H, 0, H):
        big.paste(bokeh, (dx + W, dy + H))
big = big.filter(ImageFilter.GaussianBlur(28))
bokeh = big.crop((W, H, W * 2, H * 2))
base_img.alpha_composite(bokeh)

# ---------- 3. 草叶层 ----------
blades = Image.new("RGBA", (W, H), (0, 0, 0, 0))
bd = ImageDraw.Draw(blades)

N = 6200
for _ in range(N):
    x0 = random.uniform(0, W)
    y0 = random.uniform(0, H)
    length = random.uniform(26, 86)
    angle = random.uniform(-0.32, 0.32)
    bend = random.uniform(-0.18, 0.18)
    width = random.uniform(1.1, 2.6)

    # 大部分草叶偏暗绿，少量提亮草尖做点缀
    hi = random.random() < 0.16
    if hi:
        c_base = (random.randint(26, 46), random.randint(86, 120), random.randint(48, 72))
        c_tip = (random.randint(120, 170), random.randint(190, 225), random.randint(120, 160))
    else:
        c_base = (random.randint(14, 30), random.randint(58, 92), random.randint(32, 54))
        c_tip = (random.randint(54, 92), random.randint(130, 172), random.randint(66, 100))

    for ox, oy in wrap_offsets(x0, y0, length + 6):
        draw_blade(bd, x0 + ox, y0 + oy, length, angle, bend, width, c_base, c_tip)

# 轻微模糊让草叶边缘更柔和，避免 JPEG 锯齿感
blades = blades.filter(ImageFilter.GaussianBlur(0.6))
base_img.alpha_composite(blades)

# ---------- 4. 极细颗粒（高频无缝噪声）防止大色块 ----------
grain = tileable_noise(96, 1, seed_off=37)
grain_rgb = (grain[None, :, :] * np.array([5, 7, 5])[:, None, None]).transpose(1, 2, 0)
arr = np.asarray(base_img.convert("RGB"), dtype=np.float64)
arr = np.clip(arr + grain_rgb, 0, 255).astype(np.uint8)

out = Image.fromarray(arr, "RGB")
out.save("public/images/site-bg.jpg", "JPEG", quality=86, optimize=True, progressive=True)
print("saved public/images/site-bg.jpg", out.size)
