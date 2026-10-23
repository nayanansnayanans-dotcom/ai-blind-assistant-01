# -*- coding: utf-8 -*-
import re
import html

with open('VisionAssist_AI_BCA_Project_Report_Nayana_Lakshmi.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

html_lines = []
in_code = False
in_table = False

for line in lines:
    raw = line.rstrip('\r\n')
    
    if raw.startswith('```'):
        if in_code:
            html_lines.append('</pre>')
            in_code = False
        else:
            html_lines.append('<pre>')
            in_code = True
        continue
    
    if in_code:
        html_lines.append(html.escape(raw))
        continue
        
    if raw.startswith('|') and '|' in raw[1:]:
        if not in_table:
            html_lines.append('<table>')
            in_table = True
        cells = [c.strip() for c in raw.strip('|').split('|')]
        if all(re.match(r'^:?-+:?$', c) for c in cells):
            continue  # table header separator
        tag = 'th' if 'SL.NO' in raw or 'Field' in raw or 'ID' in raw or 'Entity' in raw or 'Endpoint' in raw or 'Component' in raw or 'Language' in raw or 'Attribute' in raw or 'Relationship' in raw or 'Process' in raw else 'td'
        row_str = '<tr>' + ''.join(f'<{tag}>{html.escape(c)}</{tag}>' for c in cells) + '</tr>'
        html_lines.append(row_str)
        continue
    else:
        if in_table:
            html_lines.append('</table>')
            in_table = False

    if raw.startswith('# '):
        html_lines.append(f'<h1>{html.escape(raw[2:])}</h1>')
    elif raw.startswith('## '):
        html_lines.append(f'<h2>{html.escape(raw[3:])}</h2>')
    elif raw.startswith('### '):
        html_lines.append(f'<h3>{html.escape(raw[4:])}</h3>')
    elif raw.startswith('#### '):
        html_lines.append(f'<h4>{html.escape(raw[5:])}</h4>')
    elif raw.startswith('---'):
        html_lines.append('<hr>')
    elif raw.strip() == '':
        html_lines.append('<br>')
    else:
        # Convert inline bold
        formatted = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', html.escape(raw))
        formatted = re.sub(r'`(.*?)`', r'<code>\1</code>', formatted)
        html_lines.append(f'<p>{formatted}</p>')

if in_code:
    html_lines.append('</pre>')
if in_table:
    html_lines.append('</table>')

html_body = '\n'.join(html_lines)

html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>VisionAssist AI - BCA Project Report - B.M.S. College for Women</title>
<style>
  @page {{
    size: A4;
    margin: 25mm 25mm 25mm 25mm;
  }}
  body {{
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    line-height: 1.6;
    color: #111827;
    background-color: #f3f4f6;
    padding: 20px;
    margin: 0;
  }}
  .page-container {{
    max-width: 900px;
    margin: 0 auto;
    background: #ffffff;
    padding: 50px 65px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    border-radius: 8px;
  }}
  h1, h2, h3, h4 {{
    font-family: 'Times New Roman', Times, serif;
    color: #0f172a;
    text-align: center;
  }}
  h1 {{ font-size: 18pt; margin-bottom: 8px; }}
  h2 {{ font-size: 15pt; margin-top: 24px; margin-bottom: 12px; }}
  h3 {{ font-size: 13pt; text-align: left; margin-top: 18px; }}
  h4 {{ font-size: 12pt; text-align: left; }}
  p {{
    text-align: justify;
    text-indent: 30px;
    margin-bottom: 10px;
  }}
  table {{
    width: 100%;
    border-collapse: collapse;
    margin: 18px 0;
    font-size: 10pt;
  }}
  th, td {{
    border: 1px solid #cbd5e1;
    padding: 8px 10px;
    text-align: left;
    vertical-align: top;
  }}
  th {{
    background-color: #e2e8f0;
    font-weight: bold;
  }}
  tr:nth-child(even) {{
    background-color: #f8fafc;
  }}
  pre {{
    background-color: #f8fafc;
    border-left: 4px solid #0284c7;
    padding: 12px 16px;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 8.5pt;
    line-height: 1.35;
    overflow-x: auto;
    border-radius: 4px;
    border-top: 1px solid #e2e8f0;
    border-right: 1px solid #e2e8f0;
    border-bottom: 1px solid #e2e8f0;
  }}
  code {{
    font-family: Consolas, 'Courier New', monospace;
    background: #f1f5f9;
    padding: 2px 5px;
    border-radius: 4px;
    font-size: 9.5pt;
  }}
  hr {{
    border: none;
    border-top: 2px solid #e2e8f0;
    margin: 35px 0;
    page-break-after: always;
  }}
  .print-btn {{
    position: fixed;
    top: 20px;
    right: 30px;
    background: #0284c7;
    color: #fff;
    border: none;
    padding: 10px 18px;
    font-size: 13px;
    font-weight: bold;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(2,132,199,0.3);
  }}
  @media print {{
    body {{ background: #fff; padding: 0; }}
    .page-container {{ box-shadow: none; padding: 0; max-width: 100%; }}
    .print-btn {{ display: none; }}
  }}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
<div class="page-container">
{html_body}
</div>
</body>
</html>"""

with open('VisionAssist_AI_BCA_Project_Report_Nayana_Lakshmi.html', 'w', encoding='utf-8') as f:
    f.write(html_template)

print('Successfully generated HTML report at: VisionAssist_AI_BCA_Project_Report_Nayana_Lakshmi.html')
