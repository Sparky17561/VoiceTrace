from fpdf import FPDF
import os
import re
from datetime import datetime

# ── LIGHT THEME — Professional Blue & White ──
# All backgrounds white/off-white, blue used for accents & headings only

BLUE        = (10, 132, 255)    # #0A84FF — electric blue (accent only)
BLUE_DARK   = (37,  99, 235)    # #2563EB — section titles, headings
BLUE_LIGHT  = (235, 243, 255)   # very pale blue — card backgrounds
BLUE_MID    = (219, 234, 254)   # slightly darker pale blue — table header bg

WHITE       = (255, 255, 255)
PAGE_BG     = (250, 252, 255)   # barely-blue white — main page bg
ROW_ALT     = (245, 249, 255)   # alternating row tint

BORDER_BLUE = (191, 219, 254)   # light blue border
BORDER_GRAY = (226, 232, 240)   # soft gray separator

TEXT_DARK   = (15,  23,  42)    # #0F172A — headings
TEXT_MID    = (71,  94, 138)    # #475E8A — subtext / labels
TEXT_FAINT  = (148, 163, 184)   # very light — placeholder text

GREEN       = (22, 163, 74)     # #16A34A — revenue (readable on white)
RED         = (220, 38,  38)    # #DC2626 — expense (readable on white)
AMBER       = (202, 138,  4)    # #CA8A04 — warning


class VoiceTracePDF(FPDF):
    def __init__(self, stall_name="My Shop", stall_location="", user_name="Owner", user_phone=""):
        super().__init__()
        self.stall_name = stall_name
        self.stall_location = stall_location
        self.user_name = user_name
        self.user_phone = user_phone
        self.generated_at = datetime.now().strftime("%d %b %Y, %I:%M %p")

    def sanitize_text(self, text):
        if text is None:
            return ""
        text = str(text)
        text = text.replace("\u2014", "-")
        text = text.replace("\u2013", "-")
        text = text.replace("\u201c", '"')
        text = text.replace("\u201d", '"')
        text = text.replace("\u2018", "'")
        text = text.replace("\u2019", "'")
        return re.sub(r'[^\x00-\x7F]+', '', text)

    def header(self):
        # ── White header with blue left stripe + blue bottom border ──
        self.set_fill_color(*WHITE)
        self.rect(0, 0, 210, 26, 'F')

        # Blue left accent stripe (thin)
        self.set_fill_color(*BLUE)
        self.rect(0, 0, 4, 26, 'F')

        # App name — electric blue
        self.set_xy(10, 6)
        self.set_font("Arial", "B", 16)
        self.set_text_color(*BLUE)
        self.cell(48, 9, "VoiceTrace", ln=0)

        # Tagline — muted blue-gray
        self.set_xy(62, 9)
        self.set_font("Arial", "", 8)
        self.set_text_color(*TEXT_MID)
        self.cell(90, 5, "AI-Powered Business Intelligence", ln=0)

        # Page number
        self.set_xy(155, 9)
        self.set_font("Arial", "", 8)
        self.set_text_color(*TEXT_FAINT)
        self.cell(45, 5, f"Page {self.page_no()}", align="R", ln=1)

        # Blue bottom border under header
        self.set_draw_color(*BLUE)
        self.set_line_width(0.8)
        self.line(0, 26, 210, 26)

        # ── Pale blue stall info banner ──
        self.set_fill_color(*BLUE_LIGHT)
        self.rect(0, 26, 210, 16, 'F')

        self.set_xy(10, 28)
        self.set_font("Arial", "B", 10.5)
        self.set_text_color(*BLUE_DARK)
        self.cell(130, 6, self.sanitize_text(self.stall_name), ln=0)

        self.set_xy(10, 35)
        self.set_font("Arial", "", 7.5)
        self.set_text_color(*TEXT_MID)
        loc = self.stall_location or "Location not specified"
        user_info = f"{self.sanitize_text(self.user_name)}  |  {self.sanitize_text(self.user_phone)}"
        self.cell(100, 5, self.sanitize_text(f"Location: {loc}"), ln=0)
        self.cell(90, 5, user_info, ln=1, align="R")

        # Gray separator under stall banner
        self.set_draw_color(*BORDER_GRAY)
        self.set_line_width(0.3)
        self.line(0, 42, 210, 42)

        self.ln(12)

    def footer(self):
        self.set_y(-15)

        # Gray separator line above footer
        self.set_draw_color(*BORDER_GRAY)
        self.set_line_width(0.3)
        self.line(10, self.get_y(), 200, self.get_y())

        self.ln(1)
        self.set_font("Arial", "I", 7)
        self.set_text_color(*TEXT_FAINT)
        self.cell(95, 6, f"Generated: {self.generated_at}", ln=0)
        self.cell(95, 6, "Powered by VoiceTrace  |  All transactions AI-verified", align="R", ln=1)

    def section_title(self, title):
        # Blue-tinted section header — white page, blue text, blue left border
        self.set_fill_color(*BLUE_LIGHT)
        self.set_draw_color(*BORDER_BLUE)
        self.set_line_width(0)

        # Left bar accent
        self.set_fill_color(*BLUE)
        self.rect(10, self.get_y(), 3, 9, 'F')

        # Title background
        self.set_fill_color(*BLUE_LIGHT)
        self.set_xy(13, self.get_y())
        self.set_font("Arial", "B", 10)
        self.set_text_color(*BLUE_DARK)
        self.cell(187, 9, f"  {title}", ln=1, fill=True)

        self.ln(3)

    def kpi_card(self, label, value, color=None):
        if color is None:
            color = TEXT_DARK
        self.set_font("Arial", "", 9)
        self.set_text_color(*TEXT_MID)
        self.cell(60, 7, f"  {label}", ln=0)
        self.set_font("Arial", "B", 10.5)
        self.set_text_color(*color)
        self.cell(0, 7, value, ln=1)
        # Light gray separator
        self.set_draw_color(*BORDER_GRAY)
        self.set_line_width(0.2)
        self.line(12, self.get_y(), 200, self.get_y())

    def kpi_row(self, label, value, color=(30, 30, 30)):
        """Alias for backward compat."""
        self.kpi_card(label, value, color)


def generate_full_report(stall_name, stall_location, user_name, user_phone, date_range, sessions, summary):
    pdf = VoiceTracePDF(
        stall_name=stall_name,
        stall_location=stall_location,
        user_name=user_name,
        user_phone=user_phone,
    )
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # ── REPORT TITLE ──
    pdf.set_font("Arial", "B", 17)
    pdf.set_text_color(*BLUE_DARK)
    pdf.cell(0, 10, "Business Performance Report", ln=1, align="C")

    pdf.set_font("Arial", "", 9)
    pdf.set_text_color(*TEXT_MID)
    pdf.cell(0, 5, f"Period: {date_range}", ln=1, align="C")
    pdf.ln(8)

    # ── SUMMARY CARDS ──
    pdf.section_title("Summary Breakdown")

    total_rev = summary.get('total_revenue', 0)
    total_exp = summary.get('total_expense', 0)
    net = total_rev - total_exp
    net_color = GREEN if net >= 0 else RED

    # White card with pale blue border
    card_y = pdf.get_y()
    pdf.set_fill_color(*WHITE)
    pdf.set_draw_color(*BORDER_BLUE)
    pdf.set_line_width(0.4)
    pdf.rect(10, card_y, 190, 40, 'FD')

    pdf.ln(3)
    pdf.kpi_card("Total Revenue:", f"Rs. {total_rev:,.0f}", GREEN)
    pdf.kpi_card("Total Expenses:", f"Rs. {total_exp:,.0f}", RED)
    pdf.kpi_card("Net Profit:", f"Rs. {net:,.0f}", net_color)
    pdf.kpi_card("Days Active:", str(summary.get('days_count', 0)), BLUE_DARK)
    pdf.ln(8)

    # ── NET PROFIT HIGHLIGHT ──
    pdf.set_fill_color(*BLUE_LIGHT)
    pdf.set_draw_color(*BORDER_BLUE)
    pdf.set_line_width(0.4)
    pdf.rect(10, pdf.get_y(), 190, 12, 'FD')
    pdf.set_font("Arial", "B", 11)
    pdf.set_text_color(*BLUE_DARK)
    sign = "+" if net >= 0 else ""
    pdf.cell(0, 12, f"   Net Profit for Period: Rs. {sign}{net:,.0f}", ln=1)
    pdf.ln(8)

    # ── DAILY TRANSACTION JOURNAL ──
    pdf.section_title("Daily Transaction Journal")

    # Table header — pale blue background
    col_widths = [26, 64, 28, 30, 42]
    headers = ["DATE", "ITEM", "TYPE", "VALUE (Rs.)", "DAY PROFIT"]

    pdf.set_fill_color(*BLUE_MID)
    pdf.set_text_color(*BLUE_DARK)
    pdf.set_font("Arial", "B", 8)
    for i, h in enumerate(headers):
        align = "L" if i <= 1 else "C"
        pdf.cell(col_widths[i], 9, f"  {h}" if i <= 1 else h, border=0, fill=True, align=align)
    pdf.ln()

    # Blue line under header
    pdf.set_draw_color(*BLUE)
    pdf.set_line_width(0.5)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())

    # Rows
    row_idx = 0
    for sess in sessions:
        sess_date = sess.get("date")
        entries = sess.get("entries", [])

        for i, entry in enumerate(entries):
            is_rev = entry.get("entry_type") == "REVENUE"
            stockout = entry.get("stockout_flag", False)

            # Alternating: white / very pale blue
            bg = WHITE if row_idx % 2 == 0 else ROW_ALT
            pdf.set_fill_color(*bg)

            # DATE
            pdf.set_text_color(*TEXT_MID)
            pdf.set_font("Arial", "", 7.5)
            date_str = pdf.sanitize_text(sess_date) if i == 0 else ""
            pdf.cell(col_widths[0], 8, f"  {date_str}", border="B", fill=True)

            # ITEM
            pdf.set_text_color(*TEXT_DARK)
            item_text = pdf.sanitize_text(entry.get("item_name") or "-")[:32]
            if stockout:
                item_text += " (!)"
            pdf.cell(col_widths[1], 8, f"  {item_text}", border="B", fill=True)

            # TYPE — colored pill text
            pdf.set_font("Arial", "B", 7.5)
            if is_rev:
                pdf.set_text_color(*GREEN)
                type_label = "REV +"
            else:
                pdf.set_text_color(*RED)
                type_label = "EXP -"
            pdf.cell(col_widths[2], 8, type_label, border="B", fill=True, align="C")

            # VALUE
            val = entry.get("value", 0)
            pdf.set_font("Arial", "B", 8.5)
            pdf.set_text_color(*(GREEN if is_rev else RED))
            pdf.cell(col_widths[3], 8, f"{val:,.0f}", border="B", fill=True, align="C")

            # DAY PROFIT — only on first row of session
            if i == 0:
                p = sess.get('total_revenue', 0) - sess.get('total_expense', 0)
                sign = "+" if p >= 0 else ""
                pdf.set_text_color(*(GREEN if p >= 0 else RED))
                pdf.set_font("Arial", "B", 8)
                pdf.cell(col_widths[4], 8, f"{sign}Rs.{p:,.0f}", border="B", fill=True, align="C")
            else:
                pdf.set_text_color(*TEXT_FAINT)
                pdf.set_font("Arial", "", 7)
                pdf.cell(col_widths[4], 8, "", border="B", fill=True)

            pdf.ln()
            row_idx += 1

    # ── FOOTER SUMMARY BAND ──
    pdf.ln(4)
    pdf.set_fill_color(*BLUE_LIGHT)
    pdf.set_draw_color(*BORDER_BLUE)
    pdf.set_line_width(0.4)
    pdf.rect(10, pdf.get_y(), 190, 12, 'FD')
    pdf.set_font("Arial", "B", 9.5)
    pdf.set_text_color(*BLUE_DARK)
    pdf.cell(0, 12,
        f"   Revenue: Rs.{total_rev:,.0f}     Expenses: Rs.{total_exp:,.0f}     Net: Rs.{net:,.0f}",
        ln=1
    )

    # Save
    static_dir = os.path.join(os.getcwd(), "static/reports")
    if not os.path.exists(static_dir):
        os.makedirs(static_dir)
    filename = f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    path = os.path.join(static_dir, filename)
    pdf.output(path)
    return path
