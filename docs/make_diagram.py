"""FactON 검증 파이프라인 다이어그램 생성 스크립트.
실행: python docs/make_diagram.py
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

plt.rcParams["font.family"] = "Malgun Gothic"
plt.rcParams["axes.unicode_minus"] = False

fig, ax = plt.subplots(figsize=(11, 6.5))
ax.set_xlim(0, 11)
ax.set_ylim(0, 6.5)
ax.axis("off")

def box(x, y, w, h, text, fc="#eef2ff", ec="#4338ca", fontsize=10.5, weight="normal"):
    b = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.08,rounding_size=0.08",
                        linewidth=1.4, edgecolor=ec, facecolor=fc)
    ax.add_patch(b)
    ax.text(x + w/2, y + h/2, text, ha="center", va="center", fontsize=fontsize,
             color="#1e1b4b", weight=weight, linespacing=1.4)

def arrow(x1, y1, x2, y2, color="#6366f1"):
    a = FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=16,
                          linewidth=1.6, color=color)
    ax.add_patch(a)

# Row 1: input -> quality -> claim extraction
box(0.3, 5.2, 2.0, 0.9, "입력\n(텍스트/URL)", fc="#fef9c3", ec="#a16207")
arrow(2.3, 5.65, 2.9, 5.65)
box(2.9, 5.2, 2.2, 0.9, "입력 품질 확인\nTTAK.KO-10.1344-Part2")
arrow(5.1, 5.65, 5.7, 5.65)
box(5.7, 5.2, 2.6, 0.9, "주장 추출\n(AI GMS / 규칙기반 폴백)\nTTAK.KO-10.1419")
arrow(6.9, 5.2, 6.9, 4.4)

# Row 2: 1st matching
box(4.6, 3.5, 4.6, 0.9, "1차: 정책브리핑 '사실확인' API 매칭\n(정부 공식반박 존재 여부 확인)", fontsize=10)
arrow(4.6, 3.7, 3.0, 2.7)
arrow(9.2, 3.7, 9.6, 2.7)

box(0.3, 1.9, 3.4, 0.9, "매칭 성공\n[상충] / [근거있음] (고신뢰)\n출처: 정부 원문 그대로 표시", fc="#dcfce7", ec="#15803d", fontsize=9.5)

box(7.9, 1.9, 3.0, 0.9, "매칭 실패\n2차 AI 근거검증으로 진행", fc="#fee2e2", ec="#b91c1c", fontsize=9.5)
arrow(9.4, 1.9, 9.4, 1.2)

box(4.9, 0.25, 6.0, 0.95,
    "2차: 웹검색 교차검증 — AI GMS 1차 → (실패 시) AI GMS 2차 → (실패 시) 로컬 AI GMS\n근거확인 / 상충 / 불충분 3단계 표시  ·  TTAK.KO-10.1497",
    fontsize=9)

arrow(3.2, 2.35, 3.2, 1.2)
box(0.3, 0.25, 3.4, 0.95, "개인정보 마스킹 후 Fact Card 결과 표시\n(전화번호·주민번호) · TTAK.KO-12.0414", fc="#ede9fe", ec="#6d28d9", fontsize=9)

ax.set_title("FactON 검증 파이프라인 및 TTA 표준 4종 매핑", fontsize=13, weight="bold", pad=14)

fig.tight_layout()
fig.savefig(r"C:\Users\SSAFY\Desktop\TTA\facton\docs\pipeline_diagram.png", dpi=170)
print("saved")
