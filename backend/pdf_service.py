from fpdf import FPDF
import os
import re
from datetime import datetime

class VoiceTracePDF(FPDF):
    def __init__(self, stall_name="My Shop", stall_location="", user_name="Owner", user_phone=""):
        super().__init__()
        self.stall_name = stall_name
        self.stall_location = stall_location
        self.user_name = user_name
        self.user_phone = user_phone
        self.generated_at = datetime.now().strftime("%d %b %Y, %I:%M %p")

    def sanitize_text(self, text):
        if text is None: return ""
        text = str(text)
        """Removes unicode characters not supported by standard fonts."""
        # Replace common problematic characters
        text = text.replace("\u2014", "-")  # em-dash
        text = text.replace("\u2013", "-")  # en-dash
        text = text.replace("\u201c", '"')
        text = text.replace("\u201d", '"')
        text = text.replace("\u2018", "'")
        text = text.replace("\u2019", "'")
        # Strip all other non-ASCII characters (e.g. Emojis)
        return re.sub(r'[^\x00-\x7F]+', '', text)

    def header(self):
        # Green accent bar
        self.set_fill_color(30, 200, 160)
        self.rect(0, 0, 210, 22, 'F')

        # App logo text
        self.set_xy(10, 6)
        self.set_font("Arial", "B", 15)
        self.set_text_color(255, 255, 255)
        self.cell(40, 10, "VoiceTrace", ln=0)

        # Tagline
        self.set_font("Arial", "", 9)
        self.set_text_color(220, 255, 245)
        self.set_xy(55, 8)
        self.cell(80, 6, "AI-Driven Street Business OS", ln=0)

        # Page number on right
        self.set_font("Arial", "", 8)
        self.set_text_color(220, 255, 245)
        self.set_xy(150, 8)
        self.cell(50, 6, f"Page {self.page_no()}", align="R", ln=1)

        # Stall Header Section (Larger Stall Name)
        self.set_fill_color(15, 150, 120)
        self.rect(0, 22, 210, 18, 'F')
        self.set_xy(10, 24)
        self.set_font("Arial", "B", 12)
        self.set_text_color(255, 255, 255)
        self.cell(190, 7, f"{self.sanitize_text(self.stall_name)}", ln=1)
        
        self.set_xy(10, 31)
        self.set_font("Arial", "", 8.5)
        loc_text = f"📍 {self.stall_location}" if self.stall_location else "Location not specified"
        user_info = f"👤 {self.user_name} | 📞 {self.user_phone}"
        self.cell(100, 5, self.sanitize_text(loc_text), ln=0)
        self.cell(90, 5, self.sanitize_text(user_info), ln=1, align="R")

        self.ln(12)

    def footer(self):
        self.set_y(-18)
        self.set_fill_color(240, 245, 250)
        self.rect(0, self.get_y() - 2, 210, 20, 'F')
        self.set_draw_color(30, 200, 160)
        self.set_line_width(0.5)
        self.line(10, self.get_y() - 2, 200, self.get_y() - 2)

        self.set_font("Arial", "I", 7.5)
        self.set_text_color(100, 100, 100)
        self.cell(90, 8, f"Generated: {self.generated_at}", ln=0)
        self.cell(90, 8, "Powered by VoiceTrace  |  All transactions AI-verified", align="R", ln=1)

    def section_title(self, title):
        self.set_font("Arial", "B", 11)
        self.set_fill_color(245, 248, 250)
        self.set_text_color(15, 80, 70)
        self.cell(0, 10, f" {title}", ln=1, fill=True)
        self.ln(2)

    def kpi_row(self, label, value, color=(30, 30, 30)):
        self.set_font("Arial", "B", 9.5)
        self.set_text_color(100, 100, 100)
        self.cell(45, 8, f"  {label}", ln=0)
        self.set_font("Arial", "B", 10.5)
        self.set_text_color(*color)
        self.cell(0, 8, value, ln=1)
        self.set_draw_color(235, 235, 235)
        self.line(10, self.get_y(), 200, self.get_y())

def generate_full_report(stall_name, stall_location, user_name, user_phone, date_range, sessions, summary):
    pdf = VoiceTracePDF(stall_name=stall_name, stall_location=stall_location, user_name=user_name, user_phone=user_phone)
    pdf.set_auto_page_break(auto=True, margin=22)
    pdf.add_page()

    # ── REPORT TITLE ──
    pdf.set_font("Arial", "B", 16)
    pdf.set_text_color(20, 60, 50)
    pdf.cell(0, 10, "Business Performance Report", ln=1, align="C")
    pdf.set_font("Arial", "", 10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 6, f"Analysis Period: {date_range}", ln=1, align="C")
    pdf.ln(6)

    # ── SUMMARY SECTION ──
    pdf.section_title("Summary Breakdown")
    pdf.kpi_row("Total Revenue Received:", f"Rs. {summary.get('total_revenue', 0):.0f}", (30, 200, 150))
    pdf.kpi_row("Total Expenses Paid:", f"Rs. {summary.get('total_expense', 0):.0f}", (180, 60, 60))
    net = summary.get('total_revenue', 0) - summary.get('total_expense', 0)
    net_color = (30, 200, 150) if net >= 0 else (180, 60, 60)
    pdf.kpi_row("Net Profit Surplus:", f"Rs. {net:.0f}", net_color)
    pdf.kpi_row("Days with Activity:", str(summary.get('days_count', 0)))
    pdf.ln(10)

    # ── DETAILED JOURNAL ──
    pdf.section_title("Daily Transaction Journal")
    
    # Table headers
    pdf.set_font("Arial", "B", 8)
    pdf.set_fill_color(240, 240, 240)
    pdf.set_text_color(100, 100, 100)
    # Reduced columns: Date, Item, Type, Value, Profit Calculation
    col_widths = [25, 65, 30, 30, 40]
    headers = ["DATE", "ITEM", "TYPE", "VALUE", "NET_EFFECT"]
    for i, h in enumerate(headers):
        pdf.cell(col_widths[i], 8, h, border="B", fill=True, align="C" if i > 1 else "L")
    pdf.ln()

    for sess in sessions:
        sess_date = sess.get("date")
        entries = sess.get("entries", [])
        
        for i, entry in enumerate(entries):
            is_rev = entry.get("entry_type") == "REVENUE"
            stockout = entry.get("stockout_flag", False)
            lost = entry.get("lost_sales_flag", False)

            # Zebra striping
            pdf.set_fill_color(255, 255, 255) if i % 2 == 0 else pdf.set_fill_color(250, 252, 255)
            
            # Date
            pdf.set_text_color(80, 80, 80)
            pdf.set_font("Arial", "", 8)
            pdf.cell(col_widths[0], 8, pdf.sanitize_text(sess_date if i == 0 else ""), border="B", fill=True, align="C")

            # Item
            pdf.set_text_color(30, 30, 30)
            item_text = pdf.sanitize_text(entry.get("item_name") or "-")[:32]
            if stockout:
                item_text += " [!]"
            pdf.cell(col_widths[1], 8, item_text, border="B", fill=True)

            # Type
            type_label = "REVENUE (+)" if is_rev else "EXPENSE (-)"
            if is_rev: pdf.set_text_color(20, 130, 90)
            else: pdf.set_text_color(180, 60, 60)
            pdf.cell(col_widths[2], 8, type_label, border="B", fill=True, align="C")

            # Value
            val = entry.get("value", 0)
            pdf.set_font("Arial", "B", 8.5)
            pdf.cell(col_widths[3], 8, f"Rs. {val:.0f}", border="B", fill=True, align="C")

            # Profit effect (Daily total markers)
            pdf.set_text_color(160, 160, 160)
            pdf.set_font("Arial", "I", 7)
            if i == 0:
                p = sess.get('total_revenue', 0) - sess.get('total_expense', 0)
                pdf.set_text_color(20, 130, 90) if p >= 0 else pdf.set_text_color(180, 60, 60)
                pdf.set_font("Arial", "B", 8)
                msg = f"DAY PROFIT: {p:.0f}"
            else:
                msg = ""
            pdf.cell(col_widths[4], 8, msg, border="B", fill=True, align="R")
            
            pdf.ln()

    # Save to file
    static_dir = os.path.join(os.getcwd(), "static/reports")
    if not os.path.exists(static_dir): os.makedirs(static_dir)
    filename = f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    path = os.path.join(static_dir, filename)
    pdf.output(path)
    return path
