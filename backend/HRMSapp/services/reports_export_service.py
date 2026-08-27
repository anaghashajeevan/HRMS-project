# """
# Export performance reports to Excel or PDF.
# """
# from io import BytesIO
# from datetime import datetime
# from openpyxl import Workbook
# from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
# from openpyxl.utils import get_column_letter

# from reportlab.lib.pagesizes import A4, landscape
# from reportlab.lib import colors
# from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
# from reportlab.lib.units import cm
# from reportlab.lib.enums import TA_CENTER, TA_LEFT
# from reportlab.platypus import (
#     SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
# )

# from .reports_service import PerformanceReportsService


# class ReportsExportService:
#     """Exports performance reports to Excel and PDF formats."""

#     # ==========================================================================
#     # EXCEL EXPORTS
#     # ==========================================================================
    
#     @staticmethod
#     def _create_workbook_header(ws, title: str, columns: list):
#         """Add title + column headers to worksheet."""
#         # Title row
#         ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(columns))
#         title_cell = ws.cell(row=1, column=1, value=title)
#         title_cell.font = Font(size=16, bold=True, color='FFFFFF')
#         title_cell.fill = PatternFill('solid', fgColor='1E40AF')
#         title_cell.alignment = Alignment(horizontal='center', vertical='center')
#         ws.row_dimensions[1].height = 30
        
#         # Date row
#         ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=len(columns))
#         date_cell = ws.cell(
#             row=2, column=1,
#             value=f"Generated: {datetime.now().strftime('%d %B %Y, %H:%M')}"
#         )
#         date_cell.font = Font(size=10, italic=True, color='6B7280')
#         date_cell.alignment = Alignment(horizontal='center')
        
#         # Header row
#         header_fill = PatternFill('solid', fgColor='F3F4F6')
#         header_font = Font(bold=True, color='111827')
#         border = Border(
#             left=Side(style='thin', color='E5E7EB'),
#             right=Side(style='thin', color='E5E7EB'),
#             top=Side(style='thin', color='E5E7EB'),
#             bottom=Side(style='thin', color='D1D5DB'),
#         )
#         for col_idx, col_name in enumerate(columns, 1):
#             cell = ws.cell(row=4, column=col_idx, value=col_name)
#             cell.font = header_font
#             cell.fill = header_fill
#             cell.alignment = Alignment(horizontal='center', vertical='center')
#             cell.border = border
#         ws.row_dimensions[4].height = 25

#     @staticmethod
#     def _auto_size_columns(ws):
#         """Auto-adjust column widths."""
#         for column_index, col in enumerate(ws.iter_cols(), start=1):
#             max_length = 0
#             for cell in col:
#                 try:
#                     if cell.value:
#                         max_length = max(max_length, len(str(cell.value)))
#                 except:
#                     pass
#             adjusted_width = min(max_length + 3, 50)
#             # The title and date rows are merged; their non-anchor cells are
#             # MergedCell instances without a column_letter attribute.
#             ws.column_dimensions[get_column_letter(column_index)].width = adjusted_width

#     @staticmethod
#     def export_company_excel(cycle_id: str, cycle_name: str) -> bytes:
#         """Company-wide report as Excel."""
#         data = PerformanceReportsService.company_dashboard(cycle_id)
        
#         wb = Workbook()
        
#         # ---- Sheet 1: Summary ----
#         ws1 = wb.active
#         ws1.title = 'Summary'
        
#         ReportsExportService._create_workbook_header(
#             ws1,
#             f'Company Performance Report - {cycle_name}',
#             ['Metric', 'Value'],
#         )
        
#         summary = [
#             ('Total Scorecards', data['total_scorecards']),
#             ('Completed', f"{data['completed']} ({data['completion_pct']}%)"),
#             ('Average Score', f"{data['avg_score']}%"),
#         ]
        
#         for row_idx, (metric, value) in enumerate(summary, 5):
#             ws1.cell(row=row_idx, column=1, value=metric).font = Font(bold=True)
#             ws1.cell(row=row_idx, column=2, value=str(value))
        
#         # Rating distribution
#         ws1.cell(row=len(summary) + 6, column=1, value='Rating Distribution').font = Font(bold=True, size=12)
#         rating_labels = {1: 'Unsatisfactory', 2: 'Needs Improve', 3: 'Meets', 4: 'Exceeds', 5: 'Outstanding'}
#         for i, r in enumerate([1, 2, 3, 4, 5]):
#             count = data['rating_distribution'].get(str(r), 0)
#             row = len(summary) + 7 + i
#             ws1.cell(row=row, column=1, value=f"Rating {r} - {rating_labels[r]}")
#             ws1.cell(row=row, column=2, value=count)
        
#         ReportsExportService._auto_size_columns(ws1)
        
#         # ---- Sheet 2: Top Performers ----
#         ws2 = wb.create_sheet('Top Performers')
#         ReportsExportService._create_workbook_header(
#             ws2,
#             'Top Performers',
#             ['Rank', 'Employee ID', 'Name', 'Score (%)', 'Rating'],
#         )
#         for idx, p in enumerate(data['top_performers'], 5):
#             ws2.cell(row=idx, column=1, value=idx - 4)
#             ws2.cell(row=idx, column=2, value=p['emp_code'])
#             ws2.cell(row=idx, column=3, value=p['name'])
#             ws2.cell(row=idx, column=4, value=p['score'])
#             ws2.cell(row=idx, column=5, value=p['rating'])
#         ReportsExportService._auto_size_columns(ws2)
        
#         # ---- Sheet 3: Low Performers ----
#         ws3 = wb.create_sheet('Needs Improvement')
#         ReportsExportService._create_workbook_header(
#             ws3,
#             'Employees Needing Improvement (Rating 1-2)',
#             ['Employee ID', 'Name', 'Score (%)', 'Rating'],
#         )
#         for idx, p in enumerate(data['low_performers'], 5):
#             ws3.cell(row=idx, column=1, value=p['emp_code'])
#             ws3.cell(row=idx, column=2, value=p['name'])
#             ws3.cell(row=idx, column=3, value=p['score'])
#             ws3.cell(row=idx, column=4, value=p['rating'])
#         ReportsExportService._auto_size_columns(ws3)
        
#         # Save to bytes
#         buffer = BytesIO()
#         wb.save(buffer)
#         return buffer.getvalue()

#     @staticmethod
#     def export_department_excel(cycle_id: str, cycle_name: str) -> bytes:
#         """Department-wise report as Excel."""
#         data = PerformanceReportsService.department_report(cycle_id)
        
#         wb = Workbook()
#         ws = wb.active
#         ws.title = 'Departments'
        
#         ReportsExportService._create_workbook_header(
#             ws,
#             f'Department Performance - {cycle_name}',
#             ['Department', 'Employees', 'Avg Score (%)', 'Min', 'Max',
#              'Avg Rating', 'Top Performers', 'Needs Improvement'],
#         )
        
#         for idx, d in enumerate(data, 5):
#             ws.cell(row=idx, column=1, value=d['department_name'])
#             ws.cell(row=idx, column=2, value=d['employee_count'])
#             ws.cell(row=idx, column=3, value=d['avg_score'])
#             ws.cell(row=idx, column=4, value=d['min_score'])
#             ws.cell(row=idx, column=5, value=d['max_score'])
#             ws.cell(row=idx, column=6, value=d['avg_rating'])
#             ws.cell(row=idx, column=7, value=d['top_performer_count'])
#             ws.cell(row=idx, column=8, value=d['poor_performer_count'])
        
#         ReportsExportService._auto_size_columns(ws)
        
#         buffer = BytesIO()
#         wb.save(buffer)
#         return buffer.getvalue()

#     @staticmethod
#     def export_team_excel(manager_id: str, cycle_id: str = None) -> bytes:
#         """Team report as Excel."""
#         data = PerformanceReportsService.team_dashboard(manager_id, cycle_id)
        
#         wb = Workbook()
#         ws = wb.active
#         ws.title = 'Team'
        
#         ReportsExportService._create_workbook_header(
#             ws,
#             f'Team Performance Report',
#             ['Employee Name', 'Position', 'Cycle', 'Status', 'Score (%)', 'Rating', 'KRAs'],
#         )
        
#         for idx, m in enumerate(data['members'], 5):
#             ws.cell(row=idx, column=1, value=m['employee_name'])
#             ws.cell(row=idx, column=2, value=m['position'])
#             ws.cell(row=idx, column=3, value=m['cycle_name'])
#             ws.cell(row=idx, column=4, value=m['status'])
#             ws.cell(row=idx, column=5, value=m['final_score'] or '-')
#             ws.cell(row=idx, column=6, value=m['final_rating'] or '-')
#             ws.cell(row=idx, column=7, value=m['kra_count'])
        
#         # Summary at bottom
#         last_row = len(data['members']) + 6
#         ws.cell(row=last_row, column=1, value='TEAM STATS').font = Font(bold=True)
#         ws.cell(row=last_row + 1, column=1, value='Team Size:')
#         ws.cell(row=last_row + 1, column=2, value=data['team_size'])
#         ws.cell(row=last_row + 2, column=1, value='Reviewed:')
#         ws.cell(row=last_row + 2, column=2, value=data['reviewed_count'])
#         ws.cell(row=last_row + 3, column=1, value='Team Avg:')
#         ws.cell(row=last_row + 3, column=2, value=f"{data['team_avg_score']}%")
        
#         ReportsExportService._auto_size_columns(ws)
        
#         buffer = BytesIO()
#         wb.save(buffer)
#         return buffer.getvalue()

#     @staticmethod
#     def export_kra_excel(cycle_id: str, cycle_name: str) -> bytes:
#         """KRA achievement report as Excel."""
#         data = PerformanceReportsService.kra_achievement_report(cycle_id)
        
#         wb = Workbook()
#         ws = wb.active
#         ws.title = 'KRA Report'
        
#         ReportsExportService._create_workbook_header(
#             ws,
#             f'KRA Achievement Report - {cycle_name}',
#             ['KRA Name', 'Source', 'Employees', 'Avg Score (%)',
#              'Min', 'Max', 'Achievement % (≥90)'],
#         )
        
#         for idx, k in enumerate(data, 5):
#             ws.cell(row=idx, column=1, value=k['kra_name'])
#             ws.cell(row=idx, column=2, value=k['kra_source'])
#             ws.cell(row=idx, column=3, value=k['employee_count'])
#             ws.cell(row=idx, column=4, value=k['avg_score'])
#             ws.cell(row=idx, column=5, value=k['min_score'])
#             ws.cell(row=idx, column=6, value=k['max_score'])
#             ws.cell(row=idx, column=7, value=k['achievement_pct'])
        
#         ReportsExportService._auto_size_columns(ws)
        
#         buffer = BytesIO()
#         wb.save(buffer)
#         return buffer.getvalue()

#     @staticmethod
#     def export_individual_excel(employee_id: str, employee_name: str) -> bytes:
#         """Individual performance history as Excel."""
#         data = PerformanceReportsService.individual_history(employee_id)
        
#         wb = Workbook()
#         ws = wb.active
#         ws.title = 'History'
        
#         ReportsExportService._create_workbook_header(
#             ws,
#             f'Performance History - {employee_name}',
#             ['Cycle Name', 'Cycle Type', 'Period Start', 'Period End',
#              'Self Score', 'Peer Score', 'Manager Score', 'Final Score', 'Rating'],
#         )
        
#         for idx, h in enumerate(data['history'], 5):
#             ws.cell(row=idx, column=1, value=h['cycle_name'])
#             ws.cell(row=idx, column=2, value=h['cycle_type'])
#             ws.cell(row=idx, column=3, value=h['period_start'])
#             ws.cell(row=idx, column=4, value=h['period_end'])
#             ws.cell(row=idx, column=5, value=h['self_score'] or '-')
#             ws.cell(row=idx, column=6, value=h['peer_score'] or '-')
#             ws.cell(row=idx, column=7, value=h['manager_score'] or '-')
#             ws.cell(row=idx, column=8, value=h['final_score'])
#             ws.cell(row=idx, column=9, value=h['final_rating'])
        
#         # Summary
#         last_row = len(data['history']) + 6
#         ws.cell(row=last_row, column=1, value='SUMMARY').font = Font(bold=True)
#         ws.cell(row=last_row + 1, column=1, value='Total Cycles:')
#         ws.cell(row=last_row + 1, column=2, value=data['total_cycles'])
#         ws.cell(row=last_row + 2, column=1, value='Average Score:')
#         ws.cell(row=last_row + 2, column=2, value=f"{data['avg_score']}%")
#         ws.cell(row=last_row + 3, column=1, value='Trend:')
#         ws.cell(row=last_row + 3, column=2, value=data['trend'])
        
#         ReportsExportService._auto_size_columns(ws)
        
#         buffer = BytesIO()
#         wb.save(buffer)
#         return buffer.getvalue()

#     # ==========================================================================
#     # PDF EXPORTS
#     # ==========================================================================
    
#     @staticmethod
#     def _build_pdf_header(story, title, subtitle=None):
#         """Add title + date to PDF story."""
#         ss = getSampleStyleSheet()
        
#         title_style = ParagraphStyle(
#             'CustomTitle', parent=ss['Title'],
#             fontSize=18, textColor=colors.HexColor('#1E40AF'),
#             alignment=TA_CENTER, spaceAfter=6,
#         )
#         subtitle_style = ParagraphStyle(
#             'CustomSubtitle', parent=ss['Normal'],
#             fontSize=10, textColor=colors.HexColor('#6B7280'),
#             alignment=TA_CENTER, spaceAfter=20,
#         )
        
#         story.append(Paragraph(title, title_style))
#         if subtitle:
#             story.append(Paragraph(subtitle, subtitle_style))
#         story.append(Paragraph(
#             f"Generated: {datetime.now().strftime('%d %B %Y, %H:%M')}",
#             subtitle_style,
#         ))
#         story.append(Spacer(1, 20))

#     @staticmethod
#     def _make_pdf_table(headers, rows, col_widths=None):
#         """Create a styled table for PDF."""
#         data = [headers] + rows
#         table = Table(data, colWidths=col_widths, repeatRows=1)
#         table.setStyle(TableStyle([
#             # Header
#             ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E40AF')),
#             ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
#             ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
#             ('FONTSIZE', (0, 0), (-1, 0), 10),
#             ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
#             ('TOPPADDING', (0, 0), (-1, 0), 8),
#             ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
#             # Body
#             ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
#             ('FONTSIZE', (0, 1), (-1, -1), 9),
#             ('ALIGN', (0, 1), (-1, -1), 'LEFT'),
#             ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
#             ('TOPPADDING', (0, 1), (-1, -1), 6),
#             ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
#             # Grid
#             ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
#             # Alternating rows
#             ('ROWBACKGROUNDS', (0, 1), (-1, -1),
#              [colors.white, colors.HexColor('#F9FAFB')]),
#         ]))
#         return table

#     @staticmethod
#     def export_company_pdf(cycle_id: str, cycle_name: str) -> bytes:
#         """Company report as PDF."""
#         data = PerformanceReportsService.company_dashboard(cycle_id)
        
#         buffer = BytesIO()
#         doc = SimpleDocTemplate(
#             buffer, pagesize=A4,
#             leftMargin=1.5 * cm, rightMargin=1.5 * cm,
#             topMargin=1.5 * cm, bottomMargin=1.5 * cm,
#         )
        
#         story = []
#         ss = getSampleStyleSheet()
        
#         ReportsExportService._build_pdf_header(
#             story, 'Company Performance Report', cycle_name
#         )
        
#         # Summary section
#         story.append(Paragraph('<b>Summary</b>',
#             ParagraphStyle('SummaryHeading', parent=ss['Heading2'],
#                           fontSize=13, textColor=colors.HexColor('#1F2937'))))
        
#         summary_data = [
#             ['Metric', 'Value'],
#             ['Total Scorecards', str(data['total_scorecards'])],
#             ['Completed', f"{data['completed']} ({data['completion_pct']}%)"],
#             ['Average Score', f"{data['avg_score']}%"],
#         ]
#         story.append(ReportsExportService._make_pdf_table(
#             summary_data[0], summary_data[1:],
#             col_widths=[8 * cm, 5 * cm],
#         ))
#         story.append(Spacer(1, 20))
        
#         # Rating distribution
#         story.append(Paragraph('<b>Rating Distribution</b>',
#             ParagraphStyle('RatingHeading', parent=ss['Heading2'], fontSize=13)))
#         rating_labels = {1: 'Unsatisfactory', 2: 'Needs Improve', 3: 'Meets', 4: 'Exceeds', 5: 'Outstanding'}
#         rating_rows = []
#         for r in [1, 2, 3, 4, 5]:
#             count = data['rating_distribution'].get(str(r), 0)
#             rating_rows.append([f'Rating {r}', rating_labels[r], str(count)])
#         story.append(ReportsExportService._make_pdf_table(
#             ['Rating', 'Label', 'Count'], rating_rows,
#             col_widths=[3 * cm, 6 * cm, 4 * cm],
#         ))
#         story.append(Spacer(1, 20))
        
#         # Top performers
#         if data['top_performers']:
#             story.append(Paragraph('<b>Top Performers</b>',
#                 ParagraphStyle('TopHeading', parent=ss['Heading2'], fontSize=13)))
#             top_rows = [
#                 [str(i + 1), p['emp_code'], p['name'], f"{p['score']}%", str(p['rating'])]
#                 for i, p in enumerate(data['top_performers'])
#             ]
#             story.append(ReportsExportService._make_pdf_table(
#                 ['Rank', 'Emp ID', 'Name', 'Score', 'Rating'], top_rows,
#                 col_widths=[1.5 * cm, 3 * cm, 6 * cm, 2 * cm, 2 * cm],
#             ))
#             story.append(Spacer(1, 20))
        
#         # Low performers
#         if data['low_performers']:
#             story.append(Paragraph('<b>Employees Needing Improvement</b>',
#                 ParagraphStyle('LowHeading', parent=ss['Heading2'],
#                               fontSize=13, textColor=colors.HexColor('#DC2626'))))
#             low_rows = [
#                 [p['emp_code'], p['name'], f"{p['score']}%", str(p['rating'])]
#                 for p in data['low_performers']
#             ]
#             story.append(ReportsExportService._make_pdf_table(
#                 ['Emp ID', 'Name', 'Score', 'Rating'], low_rows,
#                 col_widths=[3 * cm, 6 * cm, 3 * cm, 2 * cm],
#             ))
        
#         doc.build(story)
#         return buffer.getvalue()

#     @staticmethod
#     def export_department_pdf(cycle_id: str, cycle_name: str) -> bytes:
#         """Department report as PDF (landscape)."""
#         data = PerformanceReportsService.department_report(cycle_id)
        
#         buffer = BytesIO()
#         doc = SimpleDocTemplate(
#             buffer, pagesize=landscape(A4),
#             leftMargin=1.5 * cm, rightMargin=1.5 * cm,
#             topMargin=1.5 * cm, bottomMargin=1.5 * cm,
#         )
        
#         story = []
#         ReportsExportService._build_pdf_header(
#             story, 'Department Performance Report', cycle_name
#         )
        
#         rows = [
#             [d['department_name'], str(d['employee_count']),
#              f"{d['avg_score']}%", f"{d['min_score']}%", f"{d['max_score']}%",
#              str(d['avg_rating']), str(d['top_performer_count']),
#              str(d['poor_performer_count'])]
#             for d in data
#         ]
        
#         story.append(ReportsExportService._make_pdf_table(
#             ['Department', 'Employees', 'Avg', 'Min', 'Max',
#              'Avg Rating', 'Top', 'Needs Improve'],
#             rows,
#         ))
        
#         doc.build(story)
#         return buffer.getvalue()

#     @staticmethod
#     def export_team_pdf(manager_id: str, cycle_id: str = None) -> bytes:
#         """Team report as PDF."""
#         data = PerformanceReportsService.team_dashboard(manager_id, cycle_id)
        
#         buffer = BytesIO()
#         doc = SimpleDocTemplate(
#             buffer, pagesize=A4,
#             leftMargin=1.5 * cm, rightMargin=1.5 * cm,
#             topMargin=1.5 * cm, bottomMargin=1.5 * cm,
#         )
        
#         story = []
#         ReportsExportService._build_pdf_header(
#             story, 'Team Performance Report',
#             f"Team Size: {data['team_size']} | Avg Score: {data['team_avg_score']}%"
#         )
        
#         rows = [
#             [m['employee_name'], m['position'], m['status'],
#              f"{m['final_score']}%" if m['final_score'] else '-',
#              str(m['final_rating']) if m['final_rating'] else '-']
#             for m in data['members']
#         ]
        
#         story.append(ReportsExportService._make_pdf_table(
#             ['Name', 'Position', 'Status', 'Score', 'Rating'], rows,
#             col_widths=[5 * cm, 4 * cm, 3 * cm, 2 * cm, 2 * cm],
#         ))
        
#         doc.build(story)
#         return buffer.getvalue()

#     @staticmethod
#     def export_kra_pdf(cycle_id: str, cycle_name: str) -> bytes:
#         """KRA achievement report as PDF."""
#         data = PerformanceReportsService.kra_achievement_report(cycle_id)
        
#         buffer = BytesIO()
#         doc = SimpleDocTemplate(
#             buffer, pagesize=A4,
#             leftMargin=1.5 * cm, rightMargin=1.5 * cm,
#             topMargin=1.5 * cm, bottomMargin=1.5 * cm,
#         )
        
#         story = []
#         ReportsExportService._build_pdf_header(
#             story, 'KRA Achievement Report', cycle_name
#         )
        
#         rows = [
#             [k['kra_name'], k['kra_source'], str(k['employee_count']),
#              f"{k['avg_score']}%", f"{k['achievement_pct']}%"]
#             for k in data
#         ]
        
#         story.append(ReportsExportService._make_pdf_table(
#             ['KRA Name', 'Source', 'Employees', 'Avg Score', 'Achievement %'],
#             rows,
#             col_widths=[6 * cm, 3 * cm, 2 * cm, 2 * cm, 3 * cm],
#         ))
        
#         doc.build(story)
#         return buffer.getvalue()

#     @staticmethod
#     def export_individual_pdf(employee_id: str, employee_name: str) -> bytes:
#         """Individual history as PDF."""
#         data = PerformanceReportsService.individual_history(employee_id)
        
#         buffer = BytesIO()
#         doc = SimpleDocTemplate(
#             buffer, pagesize=A4,
#             leftMargin=1.5 * cm, rightMargin=1.5 * cm,
#             topMargin=1.5 * cm, bottomMargin=1.5 * cm,
#         )
        
#         story = []
#         ss = getSampleStyleSheet()
        
#         ReportsExportService._build_pdf_header(
#             story, f'Performance History',
#             f"{employee_name} | Avg: {data['avg_score']}% | Trend: {data['trend']}"
#         )
        
#         rows = [
#             [h['cycle_name'], h['cycle_type'],
#              h['self_score'] and f"{h['self_score']}%" or '-',
#              h['peer_score'] and f"{h['peer_score']}%" or '-',
#              h['manager_score'] and f"{h['manager_score']}%" or '-',
#              f"{h['final_score']}%", str(h['final_rating'])]
#             for h in data['history']
#         ]
        
#         story.append(ReportsExportService._make_pdf_table(
#             ['Cycle', 'Type', 'Self', 'Peer', 'Manager', 'Final', 'Rating'],
#             rows,
#         ))
        
#         doc.build(story)
#         return buffer.getvalue()


class ReportsExportService:
    pass