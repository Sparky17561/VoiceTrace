from fpdf import FPDF
import os

def generate_pdf(total_revenue, total_expense, profit_val, profit_min, profit_max, profit_type, insight, date_str):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    
    pdf.cell(200, 10, txt="VoiceTrace Ledger Summary", ln=True, align='C')
    pdf.cell(200, 10, txt=f"Date: {date_str}", ln=True)
    pdf.cell(200, 10, txt=f"Total Revenue: {total_revenue}", ln=True)
    pdf.cell(200, 10, txt=f"Total Expense: {total_expense}", ln=True)
    
    profit_str = f"{profit_val}" if profit_type == "exact" else f"{profit_min} to {profit_max}"
    pdf.cell(200, 10, txt=f"Net Profit: {profit_str}", ln=True)
    
    pdf.multi_cell(0, 10, txt=f"Insight: {insight}")
    
    pdf_path = "./static/temp_export.pdf"
    os.makedirs(os.path.dirname(pdf_path), exist_ok=True)
    pdf.output(pdf_path)
    return pdf_path
