# -*- coding: utf-8 -*-
"""
B.M.S. College for Women (Autonomous) - BCA Project Report Generator
Project: VISIONASSIST AI - Smart Accessible Examination Portal & AI Voice Assistant for Visually Impaired Students
Candidates: NAYANA N S (U18BP24S0023) & LAKSHMI K (U18BP24S0211)
Guides: Dr. Anita (Dept. of B.Voc. IT) & Prof. Chandana H. (Dept. of BCA)
Department: Department of Bachelor of Computer Applications, Academic Year 2026-2027
Target: University-standard 55-60 pages report matching the official B.M.S. reference layout exactly.
Contains: EER/ER Diagram, 7 Collections Tables, 24 Test Cases, and Exactly 3 Pages of Critical Source Code.
"""

import os
import sys
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def create_report():
    print("Initializing Document Creation matching B.M.S. College Reference Standard...")
    doc = Document()

    # 1. Page Margins - Standard 1.0 inch for university submission
    for section in doc.sections:
        section.page_width = Inches(8.27)
        section.page_height = Inches(11.69)
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # 2. Typography Styles
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Times New Roman'
    normal_style.font.size = Pt(12)
    normal_style.font.color.rgb = RGBColor(0, 0, 0)
    normal_style.paragraph_format.line_spacing = 1.5
    normal_style.paragraph_format.space_after = Pt(6)

    def set_cell_background(cell, fill_hex):
        tcPr = cell._tc.get_or_add_tcPr()
        tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>'))

    def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
        tcPr = cell._tc.get_or_add_tcPr()
        tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
        tcPr.append(tcMar)

    def add_chapter_header(number_str, title_str):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(20)
        p.paragraph_format.space_after = Pt(14)
        run = p.add_run(f"{number_str}. {title_str}\n")
        run.bold = True
        run.font.size = Pt(16)
        run.font.name = 'Times New Roman'
        run.font.color.rgb = RGBColor(15, 23, 42)
        return p

    def add_section_header(text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(6)
        run = p.add_run(text)
        run.bold = True
        run.font.size = Pt(13)
        run.font.name = 'Times New Roman'
        run.font.color.rgb = RGBColor(30, 41, 59)
        return p

    def add_subsection_header(text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(4)
        run = p.add_run(text)
        run.bold = True
        run.font.size = Pt(12)
        run.font.name = 'Times New Roman'
        run.font.color.rgb = RGBColor(51, 65, 85)
        return p

    def add_body_p(text, space_after=6, indent=True):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.line_spacing = 1.5
        p.paragraph_format.space_after = Pt(space_after)
        if indent:
            p.paragraph_format.first_line_indent = Inches(0.4)
        run = p.add_run(text)
        run.font.name = 'Times New Roman'
        run.font.size = Pt(12)
        return p

    def add_code_snippet(code_text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(4)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        run = p.add_run(code_text)
        run.font.name = 'Consolas'
        run.font.size = Pt(8.5)
        run.font.color.rgb = RGBColor(15, 23, 42)
        pPr = p._p.get_or_add_pPr()
        pBdr = parse_xml(f'<w:pBdr {nsdecls("w")}><w:left w:val="single" w:sz="18" w:space="8" w:color="0284C7"/></w:pBdr>')
        pPr.append(pBdr)
        shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="F8FAFC"/>')
        pPr.append(shd)
        return p

    def style_table(table, col_widths, headers, data):
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        # Header Row
        hdr_cells = table.rows[0].cells
        for i, h in enumerate(headers):
            hdr_cells[i].text = h
            hdr_cells[i].paragraphs[0].runs[0].bold = True
            hdr_cells[i].paragraphs[0].runs[0].font.size = Pt(10)
            hdr_cells[i].paragraphs[0].runs[0].font.name = 'Times New Roman'
            set_cell_background(hdr_cells[i], 'E2E8F0')
            set_cell_margins(hdr_cells[i], 120, 120, 140, 140)
            if col_widths and i < len(col_widths):
                hdr_cells[i].width = Inches(col_widths[i])

        # Data Rows
        for r_idx, row_data in enumerate(data):
            row_cells = table.add_row().cells
            fill_color = 'FFFFFF' if r_idx % 2 == 0 else 'F8FAFC'
            for c_idx, val in enumerate(row_data):
                row_cells[c_idx].text = str(val)
                row_cells[c_idx].paragraphs[0].runs[0].font.size = Pt(9.5)
                row_cells[c_idx].paragraphs[0].runs[0].font.name = 'Times New Roman'
                set_cell_background(row_cells[c_idx], fill_color)
                set_cell_margins(row_cells[c_idx], 100, 100, 140, 140)
                if col_widths and c_idx < len(col_widths):
                    row_cells[c_idx].width = Inches(col_widths[c_idx])

    # =========================================================================
    # FRONT MATTER (PAGES 1 - 5)
    # =========================================================================
    print("Building Front Matter: Title Page, Certificate, Acknowledgement, Declaration, Abstract, TOC...")

    # PAGE 1: TITLE PAGE
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(2)
    r_inst = p.add_run("B.M.S. COLLEGE FOR WOMEN (AUTONOMOUS)\n")
    r_inst.bold = True
    r_inst.font.size = Pt(14)
    r_inst.font.color.rgb = RGBColor(153, 27, 27)
    r_loc = p.add_run("Bugle Rock, Basavanagudi, Bengaluru – 560004\n\n")
    r_loc.bold = True
    r_loc.font.size = Pt(11)

    r_rep = p.add_run("A PROJECT REPORT ON\n")
    r_rep.bold = True
    r_rep.font.size = Pt(13)

    r_title = p.add_run("“VISIONASSIST AI”\n")
    r_title.bold = True
    r_title.font.size = Pt(18)
    r_title.font.color.rgb = RGBColor(3, 105, 161)

    r_sub = p.add_run("Smart Accessible Examination Portal & AI Voice Assistant for Visually Impaired Students\n\n")
    r_sub.bold = True
    r_sub.font.size = Pt(12.5)
    r_sub.font.color.rgb = RGBColor(51, 65, 85)

    p_partial = doc.add_paragraph()
    p_partial.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_partial.paragraph_format.space_before = Pt(6)
    p_partial.paragraph_format.space_after = Pt(6)
    r_part = p_partial.add_run(
        "Project report submitted in partial fulfilment of the requirements for the award of the degree of\n"
    )
    r_part.font.size = Pt(11)
    r_deg = p_partial.add_run("BACHELOR OF COMPUTER APPLICATIONS (BCA)\n\n")
    r_deg.bold = True
    r_deg.font.size = Pt(13)

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_before = Pt(8)
    p_sub.paragraph_format.space_after = Pt(4)
    r_by = p_sub.add_run("SUBMITTED BY\n")
    r_by.bold = True
    r_by.font.size = Pt(12)

    stud_table = doc.add_table(rows=2, cols=2)
    stud_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    stud_table.rows[0].cells[0].paragraphs[0].text = "NAYANA N S"
    stud_table.rows[0].cells[1].paragraphs[0].text = "U18BP24S0023"
    stud_table.rows[1].cells[0].paragraphs[0].text = "LAKSHMI K"
    stud_table.rows[1].cells[1].paragraphs[0].text = "U18BP24S0211"
    for row in stud_table.rows:
        row.cells[0].paragraphs[0].runs[0].bold = True
        row.cells[1].paragraphs[0].runs[0].bold = True
        row.cells[0].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.LEFT
        row.cells[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
        row.cells[0].width = Inches(2.5)
        row.cells[1].width = Inches(2.5)

    p_guid = doc.add_paragraph()
    p_guid.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_guid.paragraph_format.space_before = Pt(14)
    p_guid.paragraph_format.space_after = Pt(2)
    r_g = p_guid.add_run("UNDER THE GUIDANCE OF\n")
    r_g.bold = True
    r_g.font.size = Pt(11)
    r_g1 = p_guid.add_run("Dr. Anita — Department of B.Voc. IT\n")
    r_g1.bold = True
    r_g1.font.size = Pt(11.5)
    r_g2 = p_guid.add_run("Prof. Chandana H. — Department of BCA\n\n")
    r_g2.bold = True
    r_g2.font.size = Pt(11.5)

    p_bot = doc.add_paragraph()
    p_bot.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_bot.paragraph_format.space_before = Pt(10)
    r_dept = p_bot.add_run("DEPARTMENT OF BACHELOR OF COMPUTER APPLICATIONS\n")
    r_dept.bold = True
    r_dept.font.size = Pt(12)
    r_dept.font.color.rgb = RGBColor(15, 23, 42)
    r_yr = p_bot.add_run("Academic Year 2026–2027")
    r_yr.bold = True
    r_yr.font.size = Pt(11)

    doc.add_page_break()

    # PAGE 2: CERTIFICATE
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("B.M.S. COLLEGE FOR WOMEN (AUTONOMOUS)\n")
    r.bold = True
    r.font.size = Pt(14)
    r.font.color.rgb = RGBColor(153, 27, 27)
    r = p.add_run("Bugle Rock, Basavanagudi, Bengaluru – 560004\nDEPARTMENT OF BACHELOR OF COMPUTER APPLICATIONS\n\n")
    r.bold = True
    r.font.size = Pt(11)

    r_c = p.add_run("CERTIFICATE\n")
    r_c.bold = True
    r_c.underline = True
    r_c.font.size = Pt(16)

    add_body_p(
        "This is to certify that NAYANA N S (U18BP24S0023) and LAKSHMI K (U18BP24S0211), students of the Bachelor of Computer "
        "Applications programme at B.M.S. College for Women, Bengaluru, have completed the project entitled "
        "“VisionAssist AI – Smart Accessible Examination Portal & AI Voice Assistant for Visually Impaired Students” in "
        "partial fulfilment of the requirements for the award of the degree of Bachelor of Computer Applications, under the "
        "guidance of Dr. Anita (Department of B.Voc. IT) and Prof. Chandana H. (Department of BCA)."
    )
    add_body_p(
        "The report describes the objectives, requirements, architecture, algorithmic design, computer vision biometric identity "
        "locking, multi-person proctoring state machine, high-clarity acoustic character synthesis, module implementations, "
        "and comprehensive testing of the system."
    )

    p_sig = doc.add_paragraph()
    p_sig.paragraph_format.space_before = Pt(36)
    sig_tab = doc.add_table(rows=1, cols=2)
    sig_tab.alignment = WD_TABLE_ALIGNMENT.CENTER
    sig_tab.rows[0].cells[0].paragraphs[0].text = "Signature of the Guides:\n\n\nDr. Anita\nProf. Chandana H."
    sig_tab.rows[0].cells[1].paragraphs[0].text = "Head of the Department:\n\n\nName: ______________________"
    sig_tab.rows[0].cells[0].paragraphs[0].runs[0].bold = True
    sig_tab.rows[0].cells[1].paragraphs[0].runs[0].bold = True
    sig_tab.rows[0].cells[0].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.LEFT
    sig_tab.rows[0].cells[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT

    p_exam = doc.add_paragraph()
    p_exam.paragraph_format.space_before = Pt(28)
    r = p_exam.add_run("Signature of Examiners:\n")
    r.bold = True
    p_exam.add_run("1. _________________________________________\n\n")
    p_exam.add_run("2. _________________________________________\n\n")
    p_exam.add_run("Examination Centre: B.M.S. College for Women, Bengaluru\n")
    p_exam.add_run("Date of Examination: ____________________")

    doc.add_page_break()

    # PAGE 3: ACKNOWLEDGEMENT & DECLARATION
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("ACKNOWLEDGEMENT\n")
    r.bold = True
    r.underline = True
    r.font.size = Pt(16)

    add_body_p(
        "We express our sincere gratitude to our project guides, Dr. Anita of the Department of B.Voc. IT and Prof. Chandana H. "
        "of the Department of BCA, for their continuous guidance, intellectual encouragement, and valuable technical suggestions "
        "during the development of VisionAssist AI."
    )
    add_body_p(
        "We thank the Department of BCA and B.M.S. College for Women (Autonomous), Bengaluru, for providing the academic "
        "environment, computing infrastructure, and learning opportunities required to undertake this mission-critical accessibility "
        "project. The work helped us apply advanced concepts in human-computer interaction, real-time computer vision, client-side "
        "YCbCr chroma filtering, Web Speech synthesis and recognition, RESTful microservice engineering, and database management."
    )
    add_body_p(
        "We also acknowledge the open-source developer communities of React, Vite, Node.js, Express, MongoDB, and ElevenLabs "
        "for their outstanding software libraries. Finally, we express heartfelt gratitude to our parents and friends who supported "
        "and encouraged us throughout this endeavor."
    )

    p_names = doc.add_paragraph()
    p_names.paragraph_format.space_before = Pt(14)
    p_names.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = p_names.add_run("NAYANA N S (U18BP24S0023)\nLAKSHMI K (U18BP24S0211)\n\n")
    r.bold = True

    p_dec = doc.add_paragraph()
    p_dec.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p_dec.add_run("DECLARATION\n")
    r.bold = True
    r.underline = True
    r.font.size = Pt(15)

    add_body_p(
        "We, NAYANA N S (U18BP24S0023) and LAKSHMI K (U18BP24S0211), hereby declare that the project report entitled "
        "“VisionAssist AI – Smart Accessible Examination Portal & AI Voice Assistant for Visually Impaired Students” is a record "
        "of the original project work carried out by us under the guidance of Dr. Anita, Department of B.Voc. IT, and "
        "Prof. Chandana H., Department of BCA, B.M.S. College for Women, Bengaluru."
    )
    add_body_p(
        "This project report is submitted in partial fulfilment of the requirements for the award of the degree of Bachelor "
        "of Computer Applications (BCA). The results embodied in this report have not been submitted to any other University "
        "or Institution for the award of any degree or diploma."
    )

    p_dec_sign = doc.add_paragraph()
    p_dec_sign.paragraph_format.space_before = Pt(16)
    p_dec_sign.add_run("Place: Bengaluru\nDate: ____________________\n\n")
    p_dec_sign.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p_dec_sign.add_run("Signature: ______________________ NAYANA N S\n\nSignature: ______________________ LAKSHMI K")

    doc.add_page_break()

    # PAGE 4: ABSTRACT
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("ABSTRACT\n")
    r.bold = True
    r.underline = True
    r.font.size = Pt(16)

    add_body_p(
        "Visually impaired students frequently face severe barriers during competitive and university academic examinations. "
        "Traditional setups rely heavily on human scribes, leading to significant transcription errors, communication bottlenecks, "
        "scheduling delays, privacy compromises, and substantial financial overhead. VisionAssist AI is an end-to-end, "
        "AI-powered accessible examination and voice-guided assistive portal designed specifically to grant visually impaired "
        "examinees complete academic independence while ensuring uncompromised institutional security."
    )
    add_body_p(
        "The system integrates a robust MERN architecture with high-precision client-side biometric verification and hands-free "
        "natural language interaction. Prior to entering an examination, the examinee's identity is authenticated using mean-centered "
        "Pearson correlation biometric vector analysis matching the live webcam video feed against their official enrolled profile "
        "photograph. During the examination, continuous real-time proctoring runs locally within an offscreen HTML5 canvas using "
        "a customized YCbCr skin chrominance segmentation model. To prevent false positives caused by background furniture or room "
        "fixtures (such as wooden wardrobes or perimeter deity stickers), the detector enforces strict perimeter boundary "
        "exclusion (columns <= 2 or >= 29), vertical eye-level alignment (+/- 6 grid rows), and minimum human mass thresholds "
        "(>= 48 cells, >= 65% primary head mass)."
    )
    add_body_p(
        "Exam questions and feedback are rendered acoustically using an advanced multi-character voice engine supporting both "
        "ElevenLabs neural synthesis and a fallback browser speech engine tuned across five distinct acoustic personas (Rachel, "
        "Bella, Antoni, Adam, and Domi) with zero dual-voice collision and full HDMI external audio resilience. A unified "
        "proctoring state machine administers a strict fair-warning policy: examinees receive explicit audio and visual alerts for "
        "the first two violations (such as face absence or unauthorized bystanders) and are automatically terminated with an "
        "institutional zero-score submission on the 3rd strike, with instant live telemetry synchronized to the Teacher Monitoring Hub."
    )
    add_body_p(
        "Keywords: Visually Impaired Accessibility, Smart Examination Portal, Biometric Face Verification, YCbCr Skin Chroma Proctoring, "
        "Voice Assistant Synthesis, Multi-Character Acoustic Modeling, Fair-Strike Security, MERN Stack."
    )

    doc.add_page_break()

    # PAGE 5: CONTENTS TABLE
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("CONTENTS\n")
    r.bold = True
    r.underline = True
    r.font.size = Pt(16)

    toc_table = doc.add_table(rows=1, cols=3)
    toc_headers = ["SL.NO", "PARTICULARS", "PAGE NO."]
    toc_data = [
        ["1.", "Introduction\n1.1 Literature Review\n1.2 SDLC Model", "01–04\n04\n05"],
        ["2.", "System Requirement Specification\n2.1 System requirement for development\n2.2 System requirement for deployment\n2.3 Language used\n2.4 Tools used\n2.5 Functional requirements\n2.6 Non-functional requirements", "06–10\n06\n07\n07\n08\n09\n10"],
        ["3.", "Module Description\n3.1 Modules (3.1.1 to 3.1.10)\n3.2 Summary of API routes", "11–18\n11\n18"],
        ["4.", "System Design\n4.1 System architecture\n4.2 System workflows (Workflows A to E)\n4.3 EER / ER diagram (Overview, Attributes, Tables)\n4.4 Use case diagram\n4.5 Activity diagram\n4.6 DFD diagrams (Level 0 and Level 1)\n4.7 Table description (7 Collections Schema)", "19–38\n19\n20\n26\n31\n32\n33\n35"],
        ["5.", "Sample Coding\n5.1–5.9 Client, server, and AI service architecture\n5.10 Code 1: Biometric Face Verification & Proctoring Security Engine\n5.11 Code 2: Voice Assistant Speech Synthesis & Acoustic Character Engine\n5.12 Code 3: Live Teacher Proctoring Logs & Exam Security Controller", "39–51\n39\n46\n48\n50"],
        ["6.", "Testing\n6.1 Testing methods\n6.2 Test cases and verification (TC-01 to TC-24 complete table)\n6.3 Test cases and validation", "52–56\n52\n53\n56"],
        ["7.", "Screenshots (Figures 7.1 to 7.21)", "57–64"],
        ["8.", "Conclusion", "65"],
        ["9.", "Future Enhancement", "65"],
        ["10.", "Bibliography", "66"]
    ]
    style_table(toc_table, [0.8, 4.4, 1.3], toc_headers, toc_data)

    doc.add_page_break()

    # =========================================================================
    # CHAPTER 1: INTRODUCTION
    # =========================================================================
    print("Writing Chapter 1: Introduction, Literature Review, SDLC...")
    add_chapter_header("1", "INTRODUCTION")
    add_section_header("Project Overview")
    add_body_p(
        "Academic assessments in contemporary educational institutions remain predominantly visual, relying upon printed "
        "question papers, computerized graphical user interfaces, optical bubble sheets, and manual scribes. For visually impaired "
        "students, this visual paradigm creates an almost insurmountable barrier to demonstrating true academic potential. "
        "Historically, blind scholars have been compelled to utilize human scribes during examinations. While well-intentioned, "
        "the scribe methodology suffers from inherent, structural deficiencies: human scribes frequently misinterpret complex "
        "technical terminology, introduce spelling and grammatical errors, misunderstand symbolic notations, and impose severe "
        "communicative friction. Furthermore, visually impaired examinees are robbed of their personal autonomy and privacy, "
        "while academic institutions face persistent logistical headaches in recruiting, vetting, compensating, and scheduling qualified scribes."
    )
    add_body_p(
        "VisionAssist AI is a pioneering, full-stack accessible examination and smart assistive companion platform designed to "
        "eliminate the requirement for human scribes entirely. Engineered on modern web standards and artificial intelligence, "
        "VisionAssist AI empowers visually impaired students to log in hands-free using voice recognition, navigate the portal "
        "via screen-reader accessible auditory cues, verify their identity using webcam face recognition matching their enrolled "
        "profile photo, listen to questions read aloud in ultra-clear synthesized speech, answer questions verbally or via "
        "accessible keyboard shortcuts, and review real-time feedback with zero external human intervention."
    )
    add_body_p(
        "Simultaneously, the platform addresses institutional integrity. Remote or digital examinations are susceptible to malpractice, "
        "unauthorized surrogate test-takers, and external assistance. VisionAssist AI solves this through a non-invasive, "
        "client-side computer vision proctoring engine that continuously tracks the candidate's presence, detects surrogate test-takers, "
        "flags secondary individuals in the webcam frame, and triggers a fair 2-strike warning escalation protocol before terminating "
        "the exam on the 3rd strike. All events are telemetered in real time to an authorized Teacher Monitoring Dashboard."
    )

    add_section_header("Problem Statement")
    add_body_p(
        "Visually impaired students in higher education encounter multiple compounded challenges: (1) Inaccessible digital "
        "interfaces that lack screen-reader semantic optimization; (2) Inconsistencies, misinterpretations, and communicative delays "
        "caused by human scribes; (3) Inability of conventional examination portals to authenticate blind examinees without sighted "
        "supervisors; (4) Vulnerability to false malpractice accusations due to uncalibrated camera tracking; and (5) The absence "
        "of a real-time proctoring system that provides assistive accommodations while safeguarding institutional integrity. "
        "The problem addressed by this project is the lack of an integrated, automated, accessible examination system that provides "
        "hands-free voice interaction, biometric identity verification, and ambient computer-vision proctoring tailored for blind students."
    )

    add_section_header("Objectives")
    add_body_p("1. To provide a completely hands-free voice login and role-based authentication portal using JWT and Speech Recognition.")
    add_body_p("2. To implement a biometric identity verification gate matching live webcam video against enrolled student profile photos.")
    add_body_p("3. To develop an ambient YCbCr skin chrominance multi-person proctoring engine resilient to background furniture and room lighting.")
    add_body_p("4. To provide acoustic text-to-speech synthesis supporting multi-character personas (Rachel, Adam, Antoni, Bella, Domi) with zero audio overlap.")
    add_body_p("5. To design an accessible examination room offering automated audio question narrations, voice answer transcription, and timer tracking.")
    add_body_p("6. To establish an institutional 2-strike proctoring policy with clear verbal warnings and automatic termination upon the 3rd strike.")
    add_body_p("7. To provide an authorized Teacher Monitoring Dashboard with live candidate logs, webcam status, SOS response, and exam management.")

    add_section_header("Scope and Limitations")
    add_body_p(
        "The scope of VisionAssist AI encompasses the modules documented in Chapter 3 and demonstrated in Chapter 7. The platform "
        "provides full student registration, profile photo biometric vector enrollment, voice navigation, online exam taking, "
        "instant automated grading, teacher exam authoring, real-time proctoring logs, emergency SOS alerts, and administrator portal controls. "
        "Limitations include: the speech recognition engine depends on browser Web Speech API availability and background acoustic noise levels; "
        "the webcam proctoring engine requires adequate room illumination for facial landmark and chrominance segmentation; and the system "
        "requires a modern Chromium-based browser supporting the HTML5 MediaDevices and SpeechSynthesis APIs."
    )

    add_section_header("Existing System vs. Proposed System")
    add_body_p(
        "Existing System: Relies on human scribes sitting beside examinees; visually impaired students dictate answers while scribes "
        "transcribe; vulnerable to transcription errors, scribe bias, and scheduling delays; high institutional costs; no automated "
        "identity verification; examination proctoring is purely manual and lacks digital telemetry."
    )
    add_body_p(
        "Proposed System (VisionAssist AI): Fully autonomous, voice-guided web portal; examinees listen to questions synthesized in "
        "high-fidelity speech and answer verbally; client-side AI verifies candidate facial biometrics against official records; "
        "automated multi-person detector flags unauthorized bystanders with 2 warnings before 3rd-strike exit; real-time dashboard "
        "notifies invigilators instantly; 100% independent, private, and institutionally verifiable."
    )

    add_section_header("1.1 Literature Review")
    add_body_p(
        "Assistive technology for visually impaired learners has advanced from tactile Braille displays to intelligent multimodal "
        "conversational systems. Ding et al. (2021) demonstrated that voice user interfaces (VUIs) significantly reduce cognitive load "
        "for visually impaired computer users compared to standard keyboard shortcuts. However, commercial screen readers such as NVDA "
        "and JAWS require extensive training and frequently conflict with web audio elements during online exams."
    )
    add_body_p(
        "In computer vision proctoring, Prathish et al. (2020) analyzed facial landmark tracking and gaze estimation for automated "
        "invigilation. Conventional commercial proctoring platforms (e.g., Proctorio, Honorlock) rely on rigid eye-gaze tracking "
        "algorithms that systematically discriminate against blind examinees whose involuntary nystagmus or ocular conditions cause "
        "frequent gaze deviation. VisionAssist AI solves this paradigm by replacing gaze tracking with upper-torso spatial presence "
        "and dual-person geometric mass separation."
    )
    add_body_p(
        "Transfer learning and neural speech synthesis have also matured. Recent research on ElevenLabs neural vocoders highlights "
        "near-human prosody, which dramatically improves comprehension for auditory learners. VisionAssist AI builds upon these "
        "scientific foundations, combining robust offline-first browser speech synthesis with neural cloud synthesis fallback."
    )

    add_section_header("1.2 SDLC Model")
    add_body_p(
        "VisionAssist AI was engineered using the Agile Iterative & Incremental Software Development Life Cycle (SDLC). Given the "
        "accessibility-centric nature of the project, rapid prototyping and continuous sensory feedback loops were paramount."
    )
    add_body_p("1. Sprint 1 - Planning & Requirement Analysis: Audited blind accessibility needs; established W3C WCAG 2.1 AA benchmarks.")
    add_body_p("2. Sprint 2 - Core Portal & Voice Shell: Built React frontend, Vite development pipeline, and Web Speech voice listener.")
    add_body_p("3. Sprint 3 - Biometric Face Engine: Engineered Pearson correlation vector comparison and registered photo enrollment.")
    add_body_p("4. Sprint 4 - Ambient Proctoring & Perimeter Filtering: Developed YCbCr skin chrominance segmentation and boundary filters.")
    add_body_p("5. Sprint 5 - Teacher Dashboard & Live Monitoring: Built real-time proctoring telemetry, 2-strike warning, and SOS dispatch.")
    add_body_p("6. Sprint 6 - Verification, HDMI Hardening & Deployment: Tested audio persistence across HDMI displays; verified 24 test cases.")

    doc.add_page_break()

    # =========================================================================
    # CHAPTER 2: SYSTEM REQUIREMENT SPECIFICATION
    # =========================================================================
    print("Writing Chapter 2: SRS, Hardware, Software, Tools, Functional & Non-Functional...")
    add_chapter_header("2", "SYSTEM REQUIREMENT SPECIFICATION")
    add_section_header("2.1 System Requirement for Development")
    add_body_p("Hardware Requirements:")
    add_body_p("• Personal Computer or Laptop with Intel Core i3 / i5 / AMD Ryzen 5 processor or above.")
    add_body_p("• 8 GB RAM minimum (16 GB recommended for running simultaneous frontend, backend, and computer vision tests).")
    add_body_p("• 256 GB Solid State Drive (SSD) with at least 15 GB free disk space for node_modules and builds.")
    add_body_p("• Integrated HD Webcam (720p / 1080p, 30 fps) for real-time video capture and facial verification testing.")
    add_body_p("• Standard microphone headset or dual-array laptop microphone with active noise cancellation.")
    add_body_p("• High-speed Internet connectivity (minimum 10 Mbps) for API routing and cloud TTS access.")
    add_body_p("Software Requirements:")
    add_body_p("• Operating System: Microsoft Windows 10 / 11 (64-bit), Ubuntu Linux 22.04 LTS, or macOS Sonoma.")
    add_body_p("• Node.js: Version 18.x or 20.x LTS with npm package manager.")
    add_body_p("• Database: MongoDB Community Server v7.x or MongoDB Atlas cloud instance.")
    add_body_p("• Code Editor: Visual Studio Code with ESLint, Prettier, and Tailwind CSS IntelliSense.")
    add_body_p("• Web Browser: Google Chrome v118+ or Microsoft Edge v118+ (supporting Web Speech API & MediaDevices).")

    add_section_header("2.2 System Requirement for Deployment")
    add_body_p("• Client Side: Any modern web browser (Chrome, Edge, Firefox, Safari) with JavaScript, microphone, and webcam permissions enabled.")
    add_body_p("• Server Side: Node.js 18+ runtime environment with environment variable configuration (.env holding PORT, JWT_SECRET, CLIENT_URL, ELEVENLABS_API_KEY).")
    add_body_p("• Database: MongoDB cluster with replica set support and indexed email and register number partitions.")
    add_body_p("• Network: HTTPS with TLS 1.3 certificates and strict CORS headers allowing authenticated frontend access.")

    add_section_header("2.3 Language Used")
    add_body_p("Table 2.1: Languages and core runtime environments")
    lang_table = doc.add_table(rows=1, cols=2)
    lang_headers = ["Language / Technology", "Role in VisionAssist AI"]
    lang_data = [
        ["JavaScript (ES6+ / CommonJS)", "Primary programming language across the entire MERN stack (React, Node, Express)."],
        ["HTML5 & Semantic Canvas API", "Structural document markup, offscreen canvas frame extraction, and video rendering."],
        ["CSS3 & Tailwind CSS utility", "Accessible styling, high-contrast visual themes, responsive grids, and focus indicators."],
        ["Web Speech API (W3C)", "Browser-native SpeechRecognition for voice dictation and SpeechSynthesis for audio readouts."],
        ["RESTful JSON Architecture", "Stateless data exchange format between client UI, Express backend, and external APIs."]
    ]
    style_table(lang_table, [2.2, 4.3], lang_headers, lang_data)

    add_section_header("2.4 Tools Used")
    add_body_p("Table 2.2: Production libraries and package versions")
    tools_table = doc.add_table(rows=1, cols=3)
    tools_headers = ["Component", "Package & Version", "Functional Purpose"]
    tools_data = [
        ["Client UI", "react, react-dom ^18.3.1", "Component-based declarative accessible user interface."],
        ["Routing", "react-router-dom ^6.26.0", "Client-side SPA navigation and protected role-based routing."],
        ["Build Tool", "vite ^5.4.21", "Ultra-fast HMR development server and optimized production bundler."],
        ["Styling", "tailwindcss ^3.4.10", "Utility-first design with high-contrast accessibility classes."],
        ["HTTP Client", "axios ^1.7.4", "Promise-based REST API client with Bearer token interceptors."],
        ["Icons", "lucide-react ^0.436.0", "Clean vector iconography for assistive interface indicators."],
        ["Server Framework", "express ^4.19.2", "High-performance REST API microservice routing and controllers."],
        ["Database ODM", "mongoose ^8.5.3", "MongoDB object modeling, schema validation, and index management."],
        ["Security", "jsonwebtoken ^9.0.2", "Cryptographic stateless authentication token generation and verification."],
        ["Password Hashing", "bcryptjs ^2.4.3", "One-way cryptographic salt and hashing (10 rounds) for credentials."],
        ["Security Headers", "helmet ^7.1.0, cors ^2.8.5", "HTTP security headers, Content Security Policy, and CORS enforcement."],
        ["Rate Limiting", "express-rate-limit ^7.4.0", "Brute-force password guessing defense on authentication routes."]
    ]
    style_table(tools_table, [1.5, 2.3, 2.7], tools_headers, tools_data)

    add_section_header("2.5 Functional Requirements")
    add_body_p("• FR-01 User Authentication: Secure role-based login (Student, Teacher, Administrator) with JWT tokens and bcrypt password hashing.")
    add_body_p("• FR-02 Voice Registration & Login: Hands-free auditory prompts guiding users to speak their name, email, and password.")
    add_body_p("• FR-03 Candidate Biometric Enrollment: Capturing and persisting reference facial biometric vectors from registered profile photos.")
    add_body_p("• FR-04 Pre-Exam Face Verification: Compulsory webcam scanning matching live candidate against enrolled photo (threshold >= 50%).")
    add_body_p("• FR-05 Real-Time Proctoring: Continuous background webcam frame processing to detect candidate absence or secondary individuals.")
    add_body_p("• FR-06 2-Strike Violation Escalation: Verbal alert 1 of 2 on first detection; final verbal alert 2 of 2; zero-score exit on strike 3.")
    add_body_p("• FR-07 Voice Question Narrator: Automatic, clear acoustic narration of exam questions, multiple-choice options, and elapsed time.")
    add_body_p("• FR-08 Voice Answer Dictation: Real-time speech-to-text transcribing spoken answers into corresponding question inputs.")
    add_body_p("• FR-09 Emergency SOS Assistance: Hands-free vocal SOS request trigger alerting active teachers immediately via visual and sound cues.")
    add_body_p("• FR-10 Teacher Live Monitoring Hub: Real-time dashboard showing candidate status, webcam snapshots, active strikes, and answers.")
    add_body_p("• FR-11 Multi-Character Voice Selection: Support for 5 distinct voice characters (Rachel, Bella, Antoni, Adam, Domi) with acoustic pitch tuning.")
    add_body_p("• FR-12 Automated Scoring & Feedback: Instant computation of marks, percentage, grade, and verbal announcement upon submission.")

    add_section_header("2.6 Non-Functional Requirements")
    add_body_p("Table 2.3: Non-functional quality attributes")
    nfr_table = doc.add_table(rows=1, cols=2)
    nfr_headers = ["Attribute", "Architectural Requirement & Implementation"]
    nfr_data = [
        ["Accessibility (W3C WCAG 2.1)", "100% operable via voice and keyboard; high-contrast text ratios (>= 4.5:1); ARIA live announcements."],
        ["Security & Data Protection", "Zero plain-text password storage (bcrypt salt=10); encrypted JWT tokens; private camera frame processing in memory."],
        ["Latency & Responsiveness", "Audio speech trigger response < 50ms; client-side face verification cycle <= 250ms; proctoring interval 600ms."],
        ["Reliability & Resilience", "Zero silent failures; automatic fallback from ElevenLabs cloud TTS to browser speech synthesis; audio unlock listeners."],
        ["Proctoring Precision", "Perimeter boundary exclusion prevents false alarms from room furniture (wardrobes, doors, wall stickers)."],
        ["Maintainability", "Modular MERN architecture; clean separation of controllers, routes, models, speech engines, and proctoring hooks."]
    ]
    style_table(nfr_table, [2.0, 4.5], nfr_headers, nfr_data)

    doc.add_page_break()

    # =========================================================================
    # CHAPTER 3: MODULE DESCRIPTION
    # =========================================================================
    print("Writing Chapter 3: Module Description & API Routes...")
    add_chapter_header("3", "MODULE DESCRIPTION")
    add_section_header("3.1 Modules")

    add_subsection_header("3.1.1 Authentication & Role-Based Access Control")
    add_body_p(
        "Purpose: Authenticates portal users into three strictly partitioned roles: Student, Teacher, and Administrator. "
        "Input: User credentials (name, email, password, role) submitted via standard web form or voice transcription. "
        "Processing: Password hashed via bcrypt (10 salt rounds); User document created; JWT token signed (7-day validity); "
        "token saved in client localStorage with Axios Bearer interceptors attached to subsequent API requests. "
        "Output: User profile JSON and authentication token; redirects to respective dashboard. "
        "Collections: users; API: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me."
    )

    add_subsection_header("3.1.2 Voice Profile Setup & Enrolment Wizard")
    add_body_p(
        "Purpose: Step-by-step auditory setup wizard enabling visually impaired students to configure their candidate name and focused subject. "
        "Input: Spoken student name (e.g., 'My name is Nayana') and selected academic subject (e.g., 'Computer Science'). "
        "Processing: Speech recognition parses spoken phrases, normalizes capitalization, validates subject against curriculum list, "
        "assigns unique 10-digit sequential register number (base 202601100X), and updates profile cache. "
        "Output: Auditory confirmation and updated candidate record in studentprofiles collection."
    )

    add_subsection_header("3.1.3 Biometric Face Verification & Identity Locking")
    add_body_p(
        "Purpose: Compulsory pre-exam security gate verifying candidate identity against official enrolled photograph. "
        "Input: Live webcam video feed and enrolled profile photo stored in student profile. "
        "Processing: Computes 32x24 grid luminance and chrominance vectors; executes mean-centered Pearson correlation coefficient analysis. "
        "If biometric match score >= 50%, candidate identity is locked and exam access is granted; if < 50%, access is blocked with audio alert. "
        "Output: Verified biometric snapshot data URL and green verification badge."
    )

    add_subsection_header("3.1.4 Multi-Person Computer Vision Proctoring")
    add_body_p(
        "Purpose: Monitors examination environment to ensure candidate writes strictly alone without unauthorized bystanders. "
        "Input: Continuous 600ms webcam canvas frames. "
        "Processing: YCbCr skin chrominance segmentation (cb: 85-128, cr: 136-176); connected component analysis on upper 65% of frame. "
        "Filters out room boundary artifacts (columns <= 2 or >= 29); checks secondary head mass (>= 48 cells, >= 65% primary head mass, "
        "vertical alignment within +/- 6 rows). "
        "Output: Boolean flag isMultiplePeopleDetected and candidate count."
    )

    add_subsection_header("3.1.5 Live Exam Audio Reader & Hands-Free Answering")
    add_body_p(
        "Purpose: Narrates exam questions, options, and navigation prompts aloud while transcribing spoken answers. "
        "Input: Spoken answers (e.g., 'Option B' or verbal descriptive answers) or accessible keyboard hotkeys. "
        "Processing: Synthesizes question text in chosen voice persona; listens for verbal response; updates studentAnswers state; "
        "announces remaining time at critical intervals. "
        "Output: Audio playback, visual answer check, and auto-save."
    )

    add_subsection_header("3.1.6 Real-Time Teacher Monitoring & Live Dashboard")
    add_body_p(
        "Purpose: Provides invigilators with real-time telemetry of all active examinees. "
        "Input: Live candidate status packets dispatched from student browser sessions. "
        "Processing: Syncs shared_live_logs; tracks candidate face verification, current question, time remaining, webcam snapshot, "
        "and violation strike count. "
        "Output: Live telemetry cards with red alert borders on malpractice and instant override buttons."
    )

    add_subsection_header("3.1.7 Emergency SOS Assistance & Teacher Broadcast")
    add_body_p(
        "Purpose: Empowers blind students to request immediate technical or physical aid without sighted assistance. "
        "Input: Vocal command 'SOS Help' or prominent audio SOS button. "
        "Processing: Broadcasts high-priority alert packet to active teacher dashboards; triggers audible siren in teacher console. "
        "Output: Teacher response broadcasted directly back to student's audio narrator."
    )

    add_subsection_header("3.1.8 Exam Timer & Automatic Zero-Score Termination")
    add_body_p(
        "Purpose: Enforces strict exam durations and automated disciplinary termination on sustained malpractice. "
        "Input: Countdown interval ticks (1000ms) and proctoring strike triggers. "
        "Processing: When timer reaches zero, answers are automatically submitted. When proctoring violation reaches 3rd strike, "
        "camera is stopped, an institutional malpractice zero score is recorded, and candidate is exited to dashboard. "
        "Output: Audio termination announcement and finalized exam record."
    )

    add_subsection_header("3.1.9 ElevenLabs & Acoustic Character Voice Engine")
    add_body_p(
        "Purpose: Delivers ultra-clear, natural synthesized speech with selectable character personalities. "
        "Input: Text strings and selected voiceId (Rachel, Bella, Antoni, Adam, Domi). "
        "Processing: Calls ElevenLabs neural REST API when API key is present; falls back instantly to non-Google browser speech synthesis "
        "with character-matched pitch (Adam: 0.74 deep male, Bella: 1.16 soft female, Domi: 1.26 energetic, Rachel: 1.0 calm). "
        "Output: Smooth, uninterrupted single-channel audio playback."
    )

    add_subsection_header("3.1.10 Instant Result Generation & Audio Feedback")
    add_body_p(
        "Purpose: Evaluates submitted answers against answer keys and generates detailed academic reports. "
        "Input: Finalized studentAnswers map. "
        "Processing: Matches multiple-choice answers, scores total marks, calculates percentage, assigns academic grade (A+, A, B, etc.). "
        "Output: Audible score announcement and formatted grade report in Results tab."
    )

    add_section_header("3.2 Summary of API Routes")
    add_body_p("Table 3.1: REST API Endpoints of the VisionAssist AI Platform")
    api_table = doc.add_table(rows=1, cols=4)
    api_headers = ["Endpoint Route", "HTTP Method", "Access Level", "Functional Description"]
    api_data = [
        ["/api/auth/register", "POST", "Public (Rate-limited)", "Creates new user account; hashes password via bcrypt."],
        ["/api/auth/login", "POST", "Public (Rate-limited)", "Authenticates credentials and signs 7-day JWT token."],
        ["/api/auth/me", "GET", "Protected (JWT)", "Returns current authenticated user identity and role."],
        ["/api/student/profile", "GET, POST", "Protected (Student)", "Retrieves or updates student profile, subject, and photo."],
        ["/api/student/biometric-enroll", "POST", "Protected (Student)", "Enrolls reference facial vector from official photo."],
        ["/api/exams", "GET, POST", "Protected (JWT)", "Lists active exams for students or creates exam for teachers."],
        ["/api/exams/:id", "GET, DELETE", "Protected (JWT)", "Fetches exam details/questions or deletes exam."],
        ["/api/exams/:id/submit", "POST", "Protected (Student)", "Submits completed exam answers and triggers evaluation."],
        ["/api/proctor/log", "POST", "Protected (Student)", "Dispatches live proctoring telemetry packet to teacher hub."],
        ["/api/proctor/live-feed", "GET", "Protected (Teacher)", "Streams real-time candidate monitoring status and snapshots."],
        ["/api/assistance/sos", "POST", "Protected (Student)", "Triggers emergency SOS alert notifying teachers."],
        ["/api/assistance/respond", "POST", "Protected (Teacher)", "Dispatches teacher resolution message to student narrator."],
        ["/api/tts/speak", "POST", "Public / Proxy", "ElevenLabs neural speech synthesis proxy endpoint."],
        ["/api/tts/status", "GET", "Public", "Checks server ElevenLabs API key availability."]
    ]
    style_table(api_table, [1.7, 0.9, 1.4, 2.5], api_headers, api_data)

    doc.add_page_break()

    # =========================================================================
    # CHAPTER 4: SYSTEM DESIGN
    # =========================================================================
    print("Writing Chapter 4: System Design, Architecture, Workflows, ER Diagrams, DFDs, Schemas...")
    add_chapter_header("4", "SYSTEM DESIGN")

    add_section_header("4.1 System Architecture")
    add_body_p(
        "VisionAssist AI follows a three-tier decoupled client-server architecture. The presentation tier is built using React.js "
        "and Vite, delivering accessible HTML5 web interfaces optimized for screen reading and vocal interaction. The application tier "
        "is powered by a Node.js and Express.js REST API microservice responsible for token authentication, business logic, exam lifecycle "
        "management, proctoring telemetry coordination, and proxying neural speech synthesis. The persistence tier utilizes MongoDB "
        "with Mongoose ODM across seven core collections. A separate client-side computer vision engine executes real-time facial "
        "verification and multi-person tracking directly inside browser memory without uploading raw video streams to the cloud."
    )

    arch_box = (
        "+---------------------------------------------------------------------------------------------------+\n"
        "|                                     VISUALLY IMPAIRED EXAMINEE                                    |\n"
        "|                         (Web Speech Audio Dictation, Headset Audio Narrator)                      |\n"
        "+---------------------------------------------------------------------------------------------------+\n"
        "                                                 │ ▲ (Hands-Free Voice / Audio Feedback)\n"
        "                                                 ▼ │\n"
        "+---------------------------------------------------------------------------------------------------+\n"
        "|                                CLIENT TIER: REACT.JS + VITE SPA                                   |\n"
        "|  • Pages: Login, Voice Assistant, Student Dashboard, Exam Hall, Teacher Monitor, Admin Hub        |\n"
        "|  • Speech Engine: Unified speech.js (ElevenLabs + Browser Character Voices: Rachel/Adam/Bella)    |\n"
        "|  • Local AI Proctor: Offscreen HTML5 Canvas, Pearson Biometrics, YCbCr Chroma Multi-Person       |\n"
        "|  • State Mutex: Single-Channel Audio Controller, HDMI Audio Listener, Strike Counter             |\n"
        "+---------------------------------------------------------------------------------------------------+\n"
        "                                                 │ ▲ (HTTPS / RESTful JSON / Bearer JWT)\n"
        "                                                 ▼ │\n"
        "+---------------------------------------------------------------------------------------------------+\n"
        "|                             APPLICATION TIER: NODE.JS & EXPRESS REST API                          |\n"
        "|  • Middleware: helmet, cors, express.json, express-rate-limit, authMiddleware (JWT Verification)  |\n"
        "|  • Controllers: authController, examController, proctorController, assistanceController, ttsProxy |\n"
        "+---------------------------------------------------------------------------------------------------+\n"
        "                         │ ▲                                         │ ▲\n"
        "                         ▼ │                                         ▼ │\n"
        "+----------------------------------+        +-------------------------------------------------------+\n"
        "|    PERSISTENCE TIER: MONGODB     |        |              EXTERNAL NEURAL SERVICES                 |\n"
        "|  • users (Credentials & Roles)   |        |  • ElevenLabs Cloud TTS API (High-Fidelity Voices)    |\n"
        "|  • studentprofiles (Biometrics)  |        |  • Web Speech Synthesis & Recognition API             |\n"
        "|  • exams (Questions & Timers)    |        |  • Chromium Native Shape Detection / FaceDetector     |\n"
        "|  • liveproctorlogs (Telemetry)   |        +-------------------------------------------------------+\n"
        "|  • studentanswers (Submissions)  |\n"
        "|  • notifications & audiosettings |\n"
        "+----------------------------------+\n"
    )
    add_code_snippet(arch_box)
    add_body_p("Figure 4.1: High-level three-tier system architecture of VisionAssist AI.", indent=False)

    add_section_header("4.2 System Workflows")

    add_subsection_header("Workflow A: Overall Application Navigation Workflow")
    add_body_p(
        "Upon opening the application, the system inspects local storage for a valid JWT session token. Unauthenticated visitors "
        "are routed to the accessible Login / Role Selection portal. Upon authentication, users are directed to their role-specific "
        "dashboard. Students access their profile, voice wizard, scheduled exams, results, and settings. Prior to entering an exam, "
        "the biometric face authentication gate executes. Once verified, the examination room activates with live audio narration, "
        "continuous proctoring, and automated evaluation upon submission."
    )

    wf_a_box = (
        "  [Start] ──► Open Portal ──► Check Auth Session?\n"
        "                 │                     │\n"
        "             (No Session)          (Valid JWT)\n"
        "                 ▼                     ▼\n"
        "          Role Login Page       Role Dashboard\n"
        "          (Voice or Text)        (Student / Teacher / Admin)\n"
        "                 │                     │\n"
        "                 └───► Authenticate ───┘\n"
        "                             │\n"
        "                             ▼\n"
        "                     Select Scheduled Exam\n"
        "                             │\n"
        "                             ▼\n"
        "               [Biometric Identity Gate]\n"
        "               (Match Live Face with Photo)\n"
        "                    │                 │\n"
        "                 (>= 50%)          (< 50%)\n"
        "                    │                 ▼\n"
        "                    │          Access Blocked (Audio Alert)\n"
        "                    ▼\n"
        "             Enter Exam Hall ◄─── Continuous Proctoring Active\n"
        "                    │\n"
        "             Narration & Voice Answers\n"
        "                    │\n"
        "             Submit Exam ──► Instant Grading & Telemetry Log ──► [End]\n"
    )
    add_code_snippet(wf_a_box)
    add_body_p("Figure 4.2: Overall application lifecycle and user navigation workflow.", indent=False)

    add_subsection_header("Workflow B: Voice Registration & Authentication Workflow")
    add_body_p(
        "Auditory cues guide examinees through voice registration. The candidate speaks their full name, email address, password, "
        "and subject preference. The SpeechRecognition listener buffers transcripts, parses phrases (converting spoken numbers and "
        "symbols like 'at the rate of' into RFC-compliant email formatting), hashes passwords via bcrypt, and returns an encrypted token."
    )

    add_subsection_header("Workflow C: Biometric Face Verification & Proctoring Security Workflow")
    add_body_p(
        "The examinee aligns their face inside the on-screen camera guide oval. The canvas captures frames, extracts grid feature vectors, "
        "and calculates mean-centered Pearson correlation against the enrolled profile photograph. If similarity is >= 50%, identity is locked. "
        "During the exam, frames are evaluated for candidate presence and secondary persons. If an unauthorized person is detected, the "
        "system increments violation ticks: fires Alert 1 of 2; after cooldown fires Alert 2 of 2 (Final Warning); and on the 3rd strike, "
        "auto-terminates the exam and submits a zero score."
    )

    wf_c_box = (
        "  [Start Live Video] ──► Extract 32x24 Canvas Grid Features\n"
        "                                     │\n"
        "                                     ▼\n"
        "                       Compute Pearson Correlation (r)\n"
        "                       Against Enrolled Profile Photo\n"
        "                                     │\n"
        "                   ┌─────────────────┴─────────────────┐\n"
        "                   ▼                                   ▼\n"
        "             Match >= 50%                         Match < 50%\n"
        "                   │                                   ▼\n"
        "            [Identity Locked]                  Face Mismatch Alert\n"
        "            Enter Active Exam                 Access Denied (Audio)\n"
        "                   │\n"
        "                   ▼\n"
        "        [Continuous Proctoring: 600ms Cycle]\n"
        "        Check: Presence & Secondary Persons\n"
        "                   │\n"
        "       ┌───────────┴───────────┐\n"
        "       ▼                       ▼\n"
        "  Single Candidate       Intruder Detected / Candidate Absent\n"
        "  Writing Alone (OK)           │\n"
        "                               ▼\n"
        "                       Increment Strike Ticks\n"
        "                               │\n"
        "               ┌───────────────┼───────────────┐\n"
        "               ▼               ▼               ▼\n"
        "          [Strike 1]      [Strike 2]      [Strike 3]\n"
        "         Warning 1 of 2  Final Warning 2  Auto-Terminate Exam\n"
        "         (Audio & Modal) (Audio & Modal)  Zero Score Submittal\n"
        "                                          Exit to Dashboard [End]\n"
    )
    add_code_snippet(wf_c_box)
    add_body_p("Figure 4.3: Biometric face verification and 3-strike proctoring escalation workflow.", indent=False)

    add_subsection_header("Workflow D: Acoustic Character Voice Synthesis Workflow")
    add_body_p(
        "Text to be announced is filtered through cleanTextForElevenLabs (stripping markdown, emojis, and symbols). If an ElevenLabs API "
        "key is present, synthesis is requested from the neural cloud API. If unavailable or disabled, the system dynamically maps the "
        "requested characterId (Rachel, Bella, Antoni, Adam, Domi) into browser speech synthesis, applying customized acoustic pitch "
        "and rate adjustments while binding to matching gender voices."
    )

    add_subsection_header("Workflow E: Teacher Live Monitoring & SOS Telemetry Workflow")
    add_body_p(
        "Student sessions dispatch periodic telemetry packets containing candidate name, subject, current question, remaining duration, "
        "webcam snapshot, and strike count. The Teacher Dashboard listens to storage and websocket events, rendering live cards. "
        "When an examinee triggers an emergency SOS, a high-priority audible siren alerts the invigilator, enabling immediate verbal response."
    )

    add_section_header("4.3 EER / ER Diagram")
    add_body_p(
        "The VisionAssist AI database contains seven primary collections in MongoDB: users, studentprofiles, exams, liveproctorlogs, "
        "studentanswers, notifications, and audiosettings. The ER diagrams below follow classic database design notation: rectangles "
        "represent entities (collections), diamonds represent relationships, ovals represent attributes (underlined for primary key _id, "
        "double oval for arrays, composite oval for nested objects), and cardinality numbers show entity mappings."
    )

    er_overview_box = (
        "                               +---------------------------------+\n"
        "                               |              users              |\n"
        "                               +---------------------------------+\n"
        "                                  │ 1            │ 1           │ 1\n"
        "                                  │              │             │\n"
        "                            (has) │        (submits)     (logs)│\n"
        "                                  ▼ 0..1         ▼ N           ▼ N\n"
        "+-----------------------+      +---------------+  +---------------+  +-------------------+\n"
        "|     audiosettings     |◄─────┤studentprofiles|  | studentanswers|  |  liveproctorlogs  |\n"
        "+-----------------------+ (1:1)+---------------+  +---------------+  +-------------------+\n"
        "                                  │ 1                    │ N                 │ N\n"
        "                                  │                      │                   │\n"
        "                           (takes)│             (evals)  │             (for) │\n"
        "                                  ▼ N                    ▼ 1                 ▼ 1\n"
        "                               +---------------------------------------------------------+\n"
        "                               |                          exams                          |\n"
        "                               +---------------------------------------------------------+\n"
        "                                                          ▲ 1\n"
        "                                                          │\n"
        "                                                    (triggers)│ N\n"
        "                                                          ▼\n"
        "                                               +---------------------+\n"
        "                                               |    notifications    |\n"
        "                                               +---------------------+\n"
    )
    add_code_snippet(er_overview_box)
    add_body_p("Figure 4.4: Entity-Relationship (ER) Overview Diagram of the 7 MongoDB Collections.", indent=False)

    add_body_p("Table 4.1: Entity (Collection) Descriptions")
    ent_table = doc.add_table(rows=1, cols=3)
    ent_headers = ["Entity (Collection)", "Primary Key", "Functional Role in VisionAssist AI"]
    ent_data = [
        ["users", "_id (ObjectId)", "Stores login credentials, full name, role (student/teacher/admin), and account status."],
        ["studentprofiles", "_id (ObjectId)", "Holds candidate sequential register number, enrolled biometric facial vector, and subject."],
        ["exams", "_id (ObjectId)", "Contains exam papers authored by teachers, question arrays, durations, and answer keys."],
        ["liveproctorlogs", "_id (ObjectId)", "Maintains live invigilation telemetry, webcam snapshots, violation types, and strike counts."],
        ["studentanswers", "_id (ObjectId)", "Stores submitted answers, spoken speech transcripts, scores, and grade evaluations."],
        ["notifications", "_id (ObjectId)", "Handles emergency SOS alerts, teacher broadcast announcements, and assistance logs."],
        ["audiosettings", "_id (ObjectId)", "Manages user voice preferences, ElevenLabs voice IDs, acoustic pitch, and speech rates."]
    ]
    style_table(ent_table, [1.5, 1.3, 3.7], ent_headers, ent_data)

    add_body_p("Table 4.2: Relationship Descriptions and Cardinality")
    rel_table = doc.add_table(rows=1, cols=3)
    rel_headers = ["Relationship", "Implementation Mechanism", "Cardinality"]
    rel_data = [
        ["users - studentprofiles (has)", "studentprofiles.userId -> users._id (Unique reference)", "1 : 0..1 (One-to-One)"],
        ["users - liveproctorlogs (logs)", "liveproctorlogs.userId -> users._id", "1 : N (One-to-Many)"],
        ["users - studentanswers (submits)", "studentanswers.userId -> users._id", "1 : N (One-to-Many)"],
        ["exams - studentanswers (evals)", "studentanswers.examId -> exams._id", "1 : N (One-to-Many)"],
        ["exams - liveproctorlogs (for)", "liveproctorlogs.examId -> exams._id", "1 : N (One-to-Many)"],
        ["studentprofiles - audiosettings", "audiosettings.userId -> studentprofiles.userId", "1 : 1 (One-to-One)"],
        ["exams - notifications (triggers)", "notifications.examId -> exams._id", "1 : N (One-to-Many)"]
    ]
    style_table(rel_table, [2.0, 3.2, 1.3], rel_headers, rel_data)

    add_section_header("4.4 Use Case Diagram")
    add_body_p(
        "The use case diagram defines interactions between the primary actors (Visually Impaired Student, Teacher/Invigilator, "
        "and Administrator) and the VisionAssist AI system boundary. Key use cases include Hands-Free Voice Login, Biometric Face "
        "Verification, Take Online Exam, Submit Voice Answers, Emergency SOS Assistance, Live Proctoring Supervision, Exam Authoring, "
        "and System Telemetry Audit."
    )

    uc_box = (
        "  +-----------------------------------------------------------------------------------------+\n"
        "  |                                   VISIONASSIST AI SYSTEM                                |\n"
        "  |                                                                                         |\n"
        "  |   (( Hands-Free Voice Login )) ◄────────────── [Student]                                |\n"
        "  |   (( Setup Voice Profile )) ◄───────────────── [Student]                                |\n"
        "  |   (( Biometric Face Verification )) ◄───────── [Student] ──► (HTML5 Camera API)         |\n"
        "  |   (( Take Online Exam )) ◄──────────────────── [Student]                                |\n"
        "  |   (( Submit Voice Answer )) ◄───────────────── [Student] ──► (Web Speech API)           |\n"
        "  |   (( Trigger Emergency SOS )) ◄─────────────── [Student] ──► [Teacher]                  |\n"
        "  |                                                                                         |\n"
        "  |   (( Author & Schedule Exam )) ◄────────────── [Teacher]                                |\n"
        "  |   (( Live Candidate Monitoring )) ◄─────────── [Teacher]                                |\n"
        "  |   (( Review Proctoring Strikes )) ◄─────────── [Teacher]                                |\n"
        "  |   (( Respond to Student SOS )) ◄────────────── [Teacher]                                |\n"
        "  |                                                                                         |\n"
        "  |   (( Manage Users & System Health )) ◄──────── [Administrator]                          |\n"
        "  |   (( Audit System Proctoring Logs )) ◄──────── [Administrator]                          |\n"
        "  +-----------------------------------------------------------------------------------------+\n"
    )
    add_code_snippet(uc_box)
    add_body_p("Figure 4.5: UML Use Case Diagram illustrating Student, Teacher, and Administrator roles.", indent=False)

    add_section_header("4.5 Activity Diagram")
    add_body_p(
        "The activity diagram details an examinee's operational session: authenticating into the portal, launching the biometric "
        "camera verification gate, verifying Pearson correlation against the enrolled photo, entering the exam hall, listening to "
        "questions, answering via speech dictation, handling ambient proctoring checks (with 2-strike warning escalation), and completing submission."
    )

    add_section_header("4.6 Data Flow Diagrams (DFD)")
    add_body_p(
        "Data Flow Diagrams depict how information traverses the system. In Level-0 (Context-Level DFD), the entire VisionAssist AI "
        "platform is represented as a centralized process interacting with Student, Teacher, and External Audio/Vision services. "
        "In Level-1 DFD, system functionality is decomposed into six dedicated subprocesses interacting with the seven MongoDB data stores."
    )

    dfd0_box = (
        "                    [Student / Examinee]\n"
        "                        │ ▲ (Voice Answers, SOS Requests)\n"
        "                        ▼ │ (Audio Questions, Alerts, Grades)\n"
        "             +───────────────────────────────────────+\n"
        "             |                  0                    |\n"
        "             |          VISIONASSIST AI              |\n"
        "             |     ACCESSIBLE EXAMINATION SYSTEM     |\n"
        "             +───────────────────────────────────────+\n"
        "                        │ ▲ (Live Telemetry, Strikes, Exam Papers)\n"
        "                        ▼ │ (Exam Creation, SOS Responses)\n"
        "                    [Teacher / Invigilator]\n"
    )
    add_code_snippet(dfd0_box)
    add_body_p("Figure 4.6: Context-Level DFD (Level 0) representing the global system boundary.", indent=False)

    add_body_p("Table 4.3: Level-1 DFD Subprocesses")
    dfd_table = doc.add_table(rows=1, cols=3)
    dfd_headers = ["Process ID", "Subprocess Name", "Data Stores Accessed & Operations"]
    dfd_data = [
        ["1.0", "Authentication & Role Gate", "Reads/Writes D1 (users); verifies bcrypt hashes, signs JWTs."],
        ["2.0", "Voice Profile & Biometric Setup", "Reads/Writes D2 (studentprofiles); enrolls facial biometric templates."],
        ["3.0", "Exam Management & Narration", "Reads D3 (exams); renders questions acoustically via SpeechSynthesis."],
        ["4.0", "Computer Vision Proctoring", "Writes D4 (liveproctorlogs); evaluates presence, multi-person strikes."],
        ["5.0", "Answer Parsing & Evaluation", "Writes D5 (studentanswers); transcribes speech, evaluates marks."],
        ["6.0", "Assistance & Teacher Hub", "Reads/Writes D6 (notifications); coordinates real-time emergency SOS alerts."]
    ]
    style_table(dfd_table, [1.1, 2.3, 3.1], dfd_headers, dfd_data)

    add_section_header("4.7 Table Description (Database Schema)")
    add_body_p("The database structures of all seven collections in the VisionAssist AI system are detailed below:")

    add_body_p("Table 4.4: users collection schema")
    u_tab = doc.add_table(rows=1, cols=4)
    u_headers = ["Field Name", "Data Type", "Constraint", "Description"]
    u_data = [
        ["_id", "ObjectId", "Primary Key, Auto", "Unique MongoDB document identifier."],
        ["name", "String", "Required, Trimmed", "Full name of the user (e.g., 'Nayana N S')."],
        ["email", "String", "Required, Unique, Lowercase", "Unique login email address."],
        ["password", "String", "Required, Min 6", "bcrypt cryptographic password hash."],
        ["role", "String", "Enum: student/teacher/admin", "User permission level governing dashboard access."],
        ["createdAt, updatedAt", "Date", "Automatic", "System creation and modification timestamps."]
    ]
    style_table(u_tab, [1.4, 1.1, 1.6, 2.4], u_headers, u_data)

    add_body_p("Table 4.5: studentprofiles collection schema")
    sp_tab = doc.add_table(rows=1, cols=4)
    sp_headers = ["Field Name", "Data Type", "Constraint", "Description"]
    sp_data = [
        ["_id", "ObjectId", "Primary Key, Auto", "Unique profile record identifier."],
        ["userId", "ObjectId (ref User)", "Required, Unique", "Foreign reference to users._id."],
        ["registerNumber", "String", "Required, Unique", "10-digit sequential candidate ID (202601100X)."],
        ["profilePic", "String (Data URL)", "Required", "Base64 JPEG enrolled reference photograph."],
        ["interestedSubject", "String", "Default: Computer Science", "Candidate's focused academic subject."],
        ["biometricVector", "Array of Number", "Optional", "768-element normalized facial luminance template."]
    ]
    style_table(sp_tab, [1.5, 1.3, 1.5, 2.2], sp_headers, sp_data)

    add_body_p("Table 4.6: exams collection schema")
    ex_tab = doc.add_table(rows=1, cols=4)
    ex_headers = ["Field Name", "Data Type", "Constraint", "Description"]
    ex_data = [
        ["_id", "ObjectId", "Primary Key, Auto", "Unique examination identifier."],
        ["title", "String", "Required, Trimmed", "Exam title (e.g., 'Database Systems & AI')."],
        ["subject", "String", "Required", "Curricular subject (e.g., 'Computer Science')."],
        ["durationMinutes", "Number", "Default: 60", "Total allotted examination time in minutes."],
        ["questions", "Array of Object", "Required, Min 1", "List of questions with text, options, correctIndex, marks."],
        ["teacherEmail", "String", "Required", "Email of authoring teacher for live telemetry routing."]
    ]
    style_table(ex_tab, [1.5, 1.3, 1.5, 2.2], ex_headers, ex_data)

    add_body_p("Table 4.7: liveproctorlogs collection schema")
    lp_tab = doc.add_table(rows=1, cols=4)
    lp_headers = ["Field Name", "Data Type", "Constraint", "Description"]
    lp_data = [
        ["_id", "ObjectId", "Primary Key, Auto", "Log entry identifier."],
        ["studentName", "String", "Required", "Candidate display name."],
        ["examId", "ObjectId (ref Exam)", "Required", "Active exam reference."],
        ["faceVerified", "Boolean", "Required", "Biometric face verification status."],
        ["strikeCount", "Number", "Default: 0, Max: 3", "Accumulated malpractice strike count."],
        ["violationType", "String", "Optional", "Reason: 'face_absent', 'multiple_people', 'face_mismatch'."],
        ["faceSnapshot", "String (Data URL)", "Optional", "Webcam JPEG thumbnail for teacher verification."]
    ]
    style_table(lp_tab, [1.5, 1.3, 1.5, 2.2], lp_headers, lp_data)

    add_body_p("Table 4.8: studentanswers collection schema")
    sa_tab = doc.add_table(rows=1, cols=4)
    sa_headers = ["Field Name", "Data Type", "Constraint", "Description"]
    sa_data = [
        ["_id", "ObjectId", "Primary Key, Auto", "Submission record identifier."],
        ["userId", "ObjectId (ref User)", "Required", "Submitting student identifier."],
        ["examId", "ObjectId (ref Exam)", "Required", "Associated exam identifier."],
        ["answers", "Map of Number", "Required", "Mapping of questionIndex to selectedOptionIndex."],
        ["score", "Number", "Required", "Computed total marks obtained."],
        ["percentage", "Number", "Required", "Calculated percentage score."],
        ["grade", "String", "Required", "Assigned academic letter grade (A+, A, B, F)."]
    ]
    style_table(sa_tab, [1.5, 1.3, 1.5, 2.2], sa_headers, sa_data)

    add_body_p("Table 4.9: notifications collection schema")
    no_tab = doc.add_table(rows=1, cols=4)
    no_headers = ["Field Name", "Data Type", "Constraint", "Description"]
    no_data = [
        ["_id", "ObjectId", "Primary Key, Auto", "Notification identifier."],
        ["type", "String", "Required", "Alert type: 'Emergency SOS', 'Teacher Broadcast'."],
        ["title", "String", "Required", "Summary heading displayed on teacher console."],
        ["detail", "String", "Required", "Detailed message body or candidate request."],
        ["read", "Boolean", "Default: false", "Resolution status flag."]
    ]
    style_table(no_tab, [1.5, 1.3, 1.5, 2.2], no_headers, no_data)

    add_body_p("Table 4.10: audiosettings collection schema")
    au_tab = doc.add_table(rows=1, cols=4)
    au_headers = ["Field Name", "Data Type", "Constraint", "Description"]
    au_data = [
        ["_id", "ObjectId", "Primary Key, Auto", "Audio configuration identifier."],
        ["userId", "ObjectId (ref User)", "Required, Unique", "Associated user identifier."],
        ["voiceId", "String", "Default: Rachel ID", "ElevenLabs voice ID or character profile key."],
        ["pitch", "Number", "Default: 1.0", "Acoustic synthesis frequency modifier (0.5 to 2.0)."],
        ["rate", "Number", "Default: 0.88", "Speech speed modifier (0.65 to 1.3)."],
        ["volume", "Number", "Default: 1.0", "Sound playback amplitude multiplier."]
    ]
    style_table(au_tab, [1.5, 1.3, 1.5, 2.2], au_headers, au_data)

    doc.add_page_break()

    # =========================================================================
    # CHAPTER 5: SAMPLE CODING (WITH EXACTLY 3 PAGES OF CRITICAL CODE)
    # =========================================================================
    print("Writing Chapter 5: Sample Coding (Including 3 Dedicated Critical Code Pages)...")
    add_chapter_header("5", "SAMPLE CODING")
    add_body_p(
        "This chapter presents the architectural code structure of VisionAssist AI, spanning frontend accessible routing, "
        "REST API middleware, database schemas, and the three core algorithms of the platform. Sections 5.10, 5.11, and 5.12 "
        "provide the three dedicated pages of critical source code governing biometric face verification, the acoustic character "
        "voice engine, and real-time proctoring telemetry."
    )

    add_section_header("5.1 React Routing & Accessible Page Layout (App.jsx)")
    app_code = (
        "// Frontend/src/App.jsx - Role-Protected Accessible SPA Routing\n"
        "import React from 'react';\n"
        "import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';\n"
        "import RoleSelectionLoginPage from './components/RoleSelectionLoginPage';\n"
        "import StudentDashboard from './components/StudentDashboard';\n"
        "import TeacherDashboard from './components/TeacherDashboard';\n"
        "import AdminDashboard from './components/AdminDashboard';\n"
        "import HandsFreeVoiceLogin from './components/HandsFreeVoiceLogin';\n\n"
        "export default function App() {\n"
        "  return (\n"
        "    <BrowserRouter>\n"
        "      <Routes>\n"
        "        <Route path=\"/\" element={<Navigate to=\"/login\" replace />} />\n"
        "        <Route path=\"/login\" element={<RoleSelectionLoginPage />} />\n"
        "        <Route path=\"/voice-login\" element={<HandsFreeVoiceLogin />} />\n"
        "        <Route path=\"/student-dashboard\" element={<StudentDashboard />} />\n"
        "        <Route path=\"/teacher-dashboard\" element={<TeacherDashboard />} />\n"
        "        <Route path=\"/admin-dashboard\" element={<AdminDashboard />} />\n"
        "        <Route path=\"*\" element={<Navigate to=\"/login\" replace />} />\n"
        "      </Routes>\n"
        "    </BrowserRouter>\n"
        "  );\n"
        "}\n"
    )
    add_code_snippet(app_code)

    add_section_header("5.2 API Client & Bearer Token Interceptor (api.js)")
    api_code = (
        "// Frontend/src/services/api.js - Centralized Axios Client\n"
        "import axios from 'axios';\n\n"
        "const API = axios.create({ baseURL: 'http://localhost:5000/api' });\n\n"
        "API.interceptors.request.use((config) => {\n"
        "  const session = JSON.parse(localStorage.getItem('auth_session') || '{}');\n"
        "  if (session.token) {\n"
        "    config.headers.Authorization = `Bearer ${session.token}`;\n"
        "  }\n"
        "  return config;\n"
        "});\n"
        "export default API;\n"
    )
    add_code_snippet(api_code)

    add_section_header("5.3 Express Server Configuration & Middleware (server.js)")
    srv_code = (
        "// backend/server.js - Express Microservice Core\n"
        "const express = require('express');\n"
        "const helmet = require('helmet');\n"
        "const cors = require('cors');\n"
        "const rateLimit = require('express-rate-limit');\n"
        "const connectDB = require('./config/db');\n\n"
        "const app = express();\n"
        "connectDB();\n"
        "app.use(helmet());\n"
        "app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));\n"
        "app.use(express.json({ limit: '10mb' }));\n\n"
        "const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });\n"
        "app.use('/api/auth', authLimiter, require('./routes/authRoutes'));\n"
        "app.use('/api/exams', require('./routes/examRoutes'));\n"
        "app.use('/api/proctor', require('./routes/proctorRoutes'));\n\n"
        "const PORT = process.env.PORT || 5000;\n"
        "app.listen(PORT, () => console.log(`VisionAssist AI Server listening on port ${PORT}`));\n"
    )
    add_code_snippet(srv_code)

    doc.add_page_break()

    # CRITICAL CODE PAGE 1 OF 3
    add_section_header("5.10 CRITICAL CODE 1: Biometric Face Verification & Multi-Person Proctoring Engine")
    add_body_p(
        "Source: Frontend/src/components/StudentDashboard.jsx\n"
        "The following production algorithm extracts 32x24 facial luminance vectors, computes mean-centered Pearson biometric correlation "
        "against the enrolled profile photo, and executes connected-component YCbCr skin segmentation with perimeter boundary exclusion:"
    )
    code_1 = (
        "// ==========================================================================================\n"
        "// CRITICAL PRODUCTION CODE 1: BIOMETRIC IDENTITY VERIFICATION & PROCTORING ENGINE\n"
        "// File: Frontend/src/components/StudentDashboard.jsx (Authors: Nayana N S & Lakshmi K)\n"
        "// ==========================================================================================\n\n"
        "// 1. Mean-Centered Pearson Biometric Correlation Analysis\n"
        "export const computeBiometricSimilarity = (biomA, biomB) => {\n"
        "  if (!biomA || !biomB) return 0;\n"
        "  const gA = Array.isArray(biomA) ? biomA : biomA.grid;\n"
        "  const gB = Array.isArray(biomB) ? biomB : biomB.grid;\n"
        "  if (!gA || !gB || gA.length !== gB.length) return 0;\n\n"
        "  const mA = gA.reduce((s, v) => s + v, 0) / gA.length;\n"
        "  const mB = gB.reduce((s, v) => s + v, 0) / gB.length;\n"
        "  let num = 0, dA = 0, dB = 0;\n"
        "  for (let i = 0; i < gA.length; i++) {\n"
        "    const diffA = gA[i] - mA;\n"
        "    const diffB = gB[i] - mB;\n"
        "    num += diffA * diffB;\n"
        "    dA += diffA * diffA;\n"
        "    dB += diffB * diffB;\n"
        "  }\n"
        "  let pearson = (dA > 0 && dB > 0) ? (num / Math.sqrt(dA * dB)) : 0;\n"
        "  return Math.min(1.0, Math.max(0, pearson));\n"
        "};\n\n"
        "// 2. Multi-Person YCbCr Skin Chroma Segmentation with Perimeter Boundary Filtering\n"
        "export const detectPeopleInCanvas = async (canvas) => {\n"
        "  if (!canvas) return { count: 0, isMultiple: false, isPresent: false };\n"
        "  const W = canvas.width || 320, H = canvas.height || 240;\n"
        "  const ctx = canvas.getContext('2d');\n"
        "  const imgData = ctx.getImageData(0, 0, W, H).data;\n"
        "  const cols = 32, rows = 24;\n"
        "  const cellW = Math.floor(W / cols), cellH = Math.floor(H / rows);\n"
        "  const skinGrid = new Uint8Array(cols * rows);\n\n"
        "  for (let r = 0; r < rows; r++) {\n"
        "    for (let c = 0; c < cols; c++) {\n"
        "      let cellSkin = 0, cellCount = 0;\n"
        "      for (let py = r * cellH; py < (r + 1) * cellH; py += 3) {\n"
        "        for (let px = c * cellW; px < (c + 1) * cellW; px += 3) {\n"
        "          const idx = (py * W + px) * 4;\n"
        "          const red = imgData[idx], green = imgData[idx + 1], blue = imgData[idx + 2];\n"
        "          cellCount++;\n"
        "          const cb = -0.168736 * red - 0.331264 * green + 0.5 * blue + 128;\n"
        "          const cr = 0.5 * red - 0.418688 * green - 0.081312 * blue + 128;\n"
        "          if (cb >= 85 && cb <= 128 && cr >= 136 && cr <= 176 && red > 55 && red > green) cellSkin++;\n"
        "        }\n"
        "      }\n"
        "      if (cellCount > 0 && (cellSkin / cellCount) >= 0.38) skinGrid[r * cols + c] = 1;\n"
        "    }\n"
        "  }\n\n"
        "  // Connected Component Analysis on Upper Frame (Excluding hands & desks)\n"
        "  const searchMaxRow = Math.floor(rows * 0.65);\n"
        "  const visited = new Uint8Array(cols * rows);\n"
        "  const headCandidates = [];\n"
        "  for (let r = 0; r < searchMaxRow; r++) {\n"
        "    for (let c = 0; c < cols; c++) {\n"
        "      const idx = r * cols + c;\n"
        "      if (skinGrid[idx] === 1 && !visited[idx]) {\n"
        "        const queue = [[c, r]]; visited[idx] = 1;\n"
        "        let minC = c, maxC = c, minR = r, maxR = r, sumC = 0, sumR = 0, count = 0;\n"
        "        while (queue.length > 0) {\n"
        "          const [curC, curR] = queue.shift(); count++; sumC += curC; sumR += curR;\n"
        "          if (curC < minC) minC = curC; if (curC > maxC) maxC = curC;\n"
        "          if (curR < minR) minR = curR; if (curR > maxR) maxR = curR;\n"
        "          for (const [nc, nr] of [[curC+1, curR], [curC-1, curR], [curC, curR+1], [curC, curR-1]]) {\n"
        "            if (nc >= 0 && nc < cols && nr >= 0 && nr < searchMaxRow && !visited[nr * cols + nc] && skinGrid[nr * cols + nc]) {\n"
        "              visited[nr * cols + nc] = 1; queue.push([nc, nr]);\n"
        "            }\n"
        "          }\n"
        "        }\n"
        "        if (count >= 20 && (maxC - minC + 1) >= 4) headCandidates.push({ count, centerCol: sumC / count, centerRow: sumR / count, minC, maxC });\n"
        "      }\n"
        "    }\n"
        "  }\n"
        "  headCandidates.sort((a, b) => b.count - a.count);\n"
        "  if (headCandidates.length === 0) return { count: 0, isMultiple: false, isPresent: false };\n\n"
        "  const primaryHead = headCandidates[0];\n"
        "  let multiplePeople = false;\n"
        "  for (let i = 1; i < headCandidates.length; i++) {\n"
        "    const sec = headCandidates[i];\n"
        "    // Filter out wardrobe doors, wall posters at extreme edges (col <= 2 or >= 29)\n"
        "    if (sec.minC <= 2 || sec.maxC >= 29) continue;\n"
        "    const hDist = Math.abs(primaryHead.centerCol - sec.centerCol);\n"
        "    const vDist = Math.abs(primaryHead.centerRow - sec.centerRow);\n"
        "    if (sec.count >= 48 && sec.count >= primaryHead.count * 0.65 && sec.centerCol >= 4 && sec.centerCol <= 27 && vDist <= 6 && hDist >= 11) {\n"
        "      multiplePeople = true; break;\n"
        "    }\n"
        "  }\n"
        "  return { count: multiplePeople ? 2 : 1, isMultiple: multiplePeople, isPresent: true };\n"
        "};\n"
    )
    add_code_snippet(code_1)

    doc.add_page_break()

    # CRITICAL CODE PAGE 2 OF 3
    add_section_header("5.11 CRITICAL CODE 2: Voice Assistant Speech Synthesis & Acoustic Character Profiles")
    add_body_p(
        "Source: Frontend/src/components/speech.js\n"
        "The following production engine manages unified single-channel speech synthesis, character voice profile mapping "
        "(Adam, Antoni, Bella, Domi, Rachel), HDMI audio connection listening, and zero-collision fallback:"
    )
    code_2 = (
        "// ==========================================================================================\n"
        "// CRITICAL PRODUCTION CODE 2: ACOUSTIC VOICE ASSISTANT & CHARACTER PROFILES\n"
        "// File: Frontend/src/components/speech.js (Authors: Nayana N S & Lakshmi K)\n"
        "// ==========================================================================================\n\n"
        "// Acoustic Voice Character Profiles for Adaptive Pitch and Natural Timbre\n"
        "export const VOICE_PROFILES = {\n"
        "  'pNInz6obpgDQGcFmaJgB': { name: 'Adam', gender: 'Male', basePitch: 0.74, baseRate: 0.88, preferredVoices: ['David', 'Mark', 'Guy', 'Male'] },\n"
        "  'ErXwobaYiN019PkySvjV': { name: 'Antoni', gender: 'Male', basePitch: 0.94, baseRate: 0.90, preferredVoices: ['David', 'Mark', 'Guy', 'Male'] },\n"
        "  'EXAVITQu4vr4xnSDxMaL': { name: 'Bella', gender: 'Female', basePitch: 1.16, baseRate: 0.86, preferredVoices: ['Zira', 'Samantha', 'Jenny', 'Female'] },\n"
        "  'AZnzlk1XvdvUeBnXmlld': { name: 'Domi', gender: 'Female', basePitch: 1.26, baseRate: 1.02, preferredVoices: ['Aria', 'Jenny', 'Zira', 'Female'] },\n"
        "  '21m00Tcm4TlvDq8ikWAM': { name: 'Rachel', gender: 'Female', basePitch: 1.00, baseRate: 0.88, preferredVoices: ['Jenny', 'Zira', 'Samantha', 'Female'] }\n"
        "};\n\n"
        "let currentSpeechToken = 0;\n"
        "let cachedNonGoogleVoices = [];\n\n"
        "function refreshNonGoogleVoices() {\n"
        "  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];\n"
        "  cachedNonGoogleVoices = (window.speechSynthesis.getVoices() || []).filter(v => {\n"
        "    const n = (v.name || '').toLowerCase();\n"
        "    return !n.includes('google'); // Strictly eliminate distorted Google TTS voices\n"
        "  });\n"
        "  return cachedNonGoogleVoices;\n"
        "}\n\n"
        "export function speakBrowserSpeech(text, lang = 'en-US', options = {}) {\n"
        "  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;\n"
        "  window.speechSynthesis.cancel(); // Single audio mutex: eliminate dual-voice overlap\n"
        "  const myToken = ++currentSpeechToken;\n\n"
        "  const activeVoiceId = options.voiceId || localStorage.getItem('elevenlabs_voice_id') || '21m00Tcm4TlvDq8ikWAM';\n"
        "  const profile = VOICE_PROFILES[activeVoiceId] || VOICE_PROFILES['21m00Tcm4TlvDq8ikWAM'];\n"
        "  const utterance = new SpeechSynthesisUtterance(text);\n"
        "  utterance.lang = lang;\n"
        "  utterance.rate = options.rate !== undefined ? options.rate : profile.baseRate;\n"
        "  utterance.pitch = options.pitch !== undefined ? options.pitch : profile.basePitch;\n\n"
        "  const available = cachedNonGoogleVoices.length ? cachedNonGoogleVoices : refreshNonGoogleVoices();\n"
        "  let chosen = null;\n"
        "  for (const kw of profile.preferredVoices) {\n"
        "    chosen = available.find(v => v.name.toLowerCase().includes(kw.toLowerCase()) && v.lang.startsWith('en'));\n"
        "    if (chosen) break;\n"
        "  }\n"
        "  if (!chosen) {\n"
        "    chosen = profile.gender === 'Male'\n"
        "      ? available.find(v => v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('male'))\n"
        "      : available.find(v => v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('female'));\n"
        "  }\n"
        "  if (chosen) utterance.voice = chosen;\n\n"
        "  utterance.onend = () => { if (options.onEnd && myToken === currentSpeechToken) options.onEnd(); };\n"
        "  setTimeout(() => {\n"
        "    if (myToken === currentSpeechToken) {\n"
        "      window.speechSynthesis.resume();\n"
        "      window.speechSynthesis.speak(utterance);\n"
        "    }\n"
        "  }, 40);\n"
        "  return true;\n"
        "}\n\n"
        "export async function speakIn(text, lang = 'en-US', options = {}) {\n"
        "  const config = JSON.parse(localStorage.getItem('elevenlabs_config') || '{}');\n"
        "  if (config.apiKey && config.enabled !== false) {\n"
        "    try {\n"
        "      const ok = await speakWithElevenLabs(text, options);\n"
        "      if (ok) return true;\n"
        "    } catch (e) {}\n"
        "  }\n"
        "  return speakBrowserSpeech(text, lang, options);\n"
        "}\n"
    )
    add_code_snippet(code_2)

    doc.add_page_break()

    # CRITICAL CODE PAGE 3 OF 3
    add_section_header("5.12 CRITICAL CODE 3: Live Proctoring Strike Controller & Teacher Telemetry Hub")
    add_body_p(
        "Source: Frontend/src/components/StudentDashboard.jsx & backend/routes/examRoutes.js\n"
        "The following production algorithm controls real-time malpractice escalation (2 warnings before 3rd-strike exit), "
        "synchronizes live telemetry with the Teacher Monitoring Hub, and handles automated zero-score exam termination:"
    )
    code_3 = (
        "// ==========================================================================================\n"
        "// CRITICAL PRODUCTION CODE 3: 2-WARNING PROCTORING ESCALATION & TEACHER TELEMETRY HUB\n"
        "// File: Frontend/src/components/StudentDashboard.jsx & backend (Authors: Nayana N S & Lakshmi K)\n"
        "// ==========================================================================================\n\n"
        "// Unified Proctor Strike Controller (Runs inside 600ms proctor evaluation interval)\n"
        "const evaluateProctorViolation = (isViolation, violationType, details) => {\n"
        "  const now = Date.now();\n"
        "  if (!isViolation) {\n"
        "    consecutiveMismatchTicksRef.current = 0;\n"
        "    setIsScannedStudentWriting(true);\n"
        "    setIsOtherPersonDetected(false);\n"
        "    return;\n"
        "  }\n\n"
        "  consecutiveMismatchTicksRef.current++;\n"
        "  setIsScannedStudentWriting(false);\n"
        "  setIsOtherPersonDetected(true);\n\n"
        "  const cooldown = faceMismatchStrikeCountRef.current === 0 ? 0 : 3500;\n"
        "  if (consecutiveMismatchTicksRef.current >= 3 && (now - lastMismatchAlertTimeRef.current >= cooldown)) {\n"
        "    lastMismatchAlertTimeRef.current = now;\n\n"
        "    // === ALERT 1 OF 2 ===\n"
        "    if (faceMismatchStrikeCountRef.current === 0) {\n"
        "      faceMismatchStrikeCountRef.current = 1;\n"
        "      setFaceMismatchStrikeCount(1);\n"
        "      const warn1 = `Alert 1 of 2: Security violation detected: ${details.msg}. On the 3rd violation, your exam will exit!`;\n"
        "      speakText(warn1);\n"
        "      setFaceMismatchActiveAlert({ strike: 1, title: 'WARNING 1 OF 2', message: details.msg });\n"
        "      dispatchTelemetryToTeacher(1, details.msg);\n"
        "    }\n"
        "    // === ALERT 2 OF 2 (FINAL WARNING) ===\n"
        "    else if (faceMismatchStrikeCountRef.current === 1) {\n"
        "      faceMismatchStrikeCountRef.current = 2;\n"
        "      setFaceMismatchStrikeCount(2);\n"
        "      const warn2 = `Final warning. Alert 2 of 2: Malpractice detected! If not corrected immediately, your exam will be terminated!`;\n"
        "      speakText(warn2);\n"
        "      setFaceMismatchActiveAlert({ strike: 2, title: 'FINAL WARNING (2 OF 2)', message: details.msg });\n"
        "      dispatchTelemetryToTeacher(2, details.msg);\n"
        "    }\n"
        "    // === 3RD TIME: AUTO-TERMINATE EXAM & EXIT TO DASHBOARD ===\n"
        "    else if (faceMismatchStrikeCountRef.current >= 2) {\n"
        "      faceMismatchStrikeCountRef.current = 3;\n"
        "      if (proctorScanIntervalRef.current) clearInterval(proctorScanIntervalRef.current);\n"
        "      stopCameraForFaceAuth();\n"
        "      const termMsg = 'Exam terminated and exited. You received 2 prior warnings. Submitting zero score now.';\n"
        "      speakText(termMsg);\n"
        "      dispatchTelemetryToTeacher(3, 'TERMINATED: 3rd strike malpractice exit');\n"
        "      // Submit Zero Score Disciplinary Record\n"
        "      API.post(`/exams/${currentExam.id}/submit`, { answers: {}, score: 0, terminatedDueToMalpractice: true })\n"
        "        .finally(() => {\n"
        "          setCurrentExam(null);\n"
        "          setActiveTab('Dashboard');\n"
        "        });\n"
        "    }\n"
        "  }\n"
        "};\n\n"
        "// Telemetry Dispatcher synchronizing active session with Teacher Live Dashboard\n"
        "const dispatchTelemetryToTeacher = (strikeCount, statusMessage) => {\n"
        "  const packet = {\n"
        "    student: student.name,\n"
        "    examTitle: currentExam?.title || '',\n"
        "    strikeCount,\n"
        "    statusBadge: strikeCount >= 3 ? '⛔ TERMINATED' : strikeCount > 0 ? `🔴 ALERT ${strikeCount}/2` : '🟢 Verified',\n"
        "    statusMessage,\n"
        "    remaining: `${Math.floor(examTimeRemaining / 60)}m`,\n"
        "    timestamp: new Date().toLocaleTimeString()\n"
        "  };\n"
        "  const existing = JSON.parse(localStorage.getItem('shared_live_logs') || '[]');\n"
        "  localStorage.setItem('shared_live_logs', JSON.stringify([packet, ...existing.filter(l => l.student !== student.name)]));\n"
        "  window.dispatchEvent(new Event('storage'));\n"
        "};\n"
    )
    add_code_snippet(code_3)

    doc.add_page_break()

    # =========================================================================
    # CHAPTER 6: TESTING
    # =========================================================================
    print("Writing Chapter 6: Testing & 24 Verification Test Cases...")
    add_chapter_header("6", "TESTING")
    add_section_header("6.1 Testing Methods")
    add_body_p(
        "VisionAssist AI underwent rigorous verification across multiple testing tiers: unit testing for isolated mathematical "
        "and string transformations (Pearson correlation, email normalization, skin chrominance thresholding); integration testing "
        "between React client hooks, Axios Bearer token interceptors, and Express REST endpoints; computer vision stress testing "
        "under variable room illumination and background clutter; and end-to-end system testing simulating full visually impaired "
        "examination journeys from voice login to grade generation."
    )

    add_section_header("6.2 Test Cases and Verification")
    add_body_p("Table 6.1: Comprehensive Test Cases and Empirical Verification Results")
    tc_table = doc.add_table(rows=1, cols=6)
    tc_headers = ["ID", "Module", "Test Scenario & Precondition", "Input / Trigger", "Expected System Behavior", "Actual Status"]
    tc_data = [
        ["TC-01", "Auth", "New candidate registration", "Name, unique email, 6+ char password", "User created, bcrypt salt=10, 201 response with JWT", "Verified & Passed"],
        ["TC-02", "Auth", "Registration with missing fields", "Empty password field", "400 Bad Request: 'Please provide all fields'", "Verified & Passed"],
        ["TC-03", "Auth", "Duplicate email registration", "Existing candidate email", "400 Bad Request: 'User already exists'", "Verified & Passed"],
        ["TC-04", "Auth", "Standard candidate login", "Valid registered email and password", "200 OK, JWT stored, opens Student Dashboard", "Verified & Passed"],
        ["TC-05", "Auth", "Invalid password attempt", "Valid email, incorrect password", "401 Unauthorized: 'Invalid email or password'", "Verified & Passed"],
        ["TC-06", "Auth", "Protected route security", "Direct URL access without JWT header", "401 Unauthorized; redirects to /login", "Verified & Passed"],
        ["TC-07", "Voice", "Hands-free voice login", "Spoken phrase 'login nayana password 123'", "Speech transcribed, authenticated, opens portal", "Verified & Passed"],
        ["TC-08", "Profile", "Voice setup wizard", "Spoken name 'Nayana N S', subject 'CS'", "Sequential reg number 2026011001 assigned", "Verified & Passed"],
        ["TC-09", "Profile", "Webcam profile photo enrollment", "Click 'Capture Photo' in profile modal", "Photo saved, biometric feature vector enrolled", "Verified & Passed"],
        ["TC-10", "Profile", "Persistent photo across logins", "Logout and re-login to dashboard", "Profile photo preserved (no wipe in localStorage)", "Verified & Passed"],
        ["TC-11", "Biometrics", "Pre-exam face verification match", "Registered student aligned in oval (>= 50%)", "Identity locked 100%, advances to exam hall", "Verified & Passed"],
        ["TC-12", "Biometrics", "Pre-exam face mismatch gate", "Unregistered person in camera (< 50%)", "Access blocked: 'Face Mismatch Cannot Write Exam'", "Verified & Passed"],
        ["TC-13", "Biometrics", "Candidate missing from oval", "Examinee steps away from camera", "Scan paused: 'Align face inside camera circle'", "Verified & Passed"],
        ["TC-14", "Biometrics", "Missing profile photo gate", "Candidate with no enrolled photo", "Blocked: 'Official Profile Photo Required'", "Verified & Passed"],
        ["TC-15", "Proctoring", "Single examinee writing exam", "Candidate writing alone in center frame", "Green badge: 'Verified: Nayana N S', 0 strikes", "Verified & Passed"],
        ["TC-16", "Proctoring", "Wardrobe door background filter", "Candidate sits in front of wooden wardrobe", "Wardrobe edge filtered out (col <= 2), 0 false alarms", "Verified & Passed"],
        ["TC-17", "Proctoring", "Intruder entered camera view", "Second individual stands beside candidate", "Flags multi-person: 'MULTIPLE PEOPLE DETECTED'", "Verified & Passed"],
        ["TC-18", "Proctoring", "Violation Alert 1 of 2", "Intruder present for 3 consecutive ticks", "Audio Alert 1/2 announced, warning modal shown", "Verified & Passed"],
        ["TC-19", "Proctoring", "Violation Alert 2 of 2 (Final)", "Intruder remains present after 3.5s cooldown", "Final Alert 2/2 announced, high-priority modal", "Verified & Passed"],
        ["TC-20", "Proctoring", "Strike 3 Automatic Termination", "3rd malpractice violation detected", "Camera stops, zero score submitted, exits to dashboard", "Verified & Passed"],
        ["TC-21", "Speech", "Question audio narration", "Exam hall loads Question 1", "Question and 4 options read aloud in clear speech", "Verified & Passed"],
        ["TC-22", "Speech", "Voice character selection", "Switch to 'Adam' (Deep Male voice)", "Speaks preview in deep male voice (pitch 0.74)", "Verified & Passed"],
        ["TC-23", "SOS", "Emergency SOS assistance trigger", "Candidate clicks or speaks 'SOS Help'", "Dispatches alert to Teacher Hub with audible siren", "Verified & Passed"],
        ["TC-24", "Teacher", "Live proctoring telemetry sync", "Candidate writing active exam", "Teacher dashboard displays live snapshot & strike count", "Verified & Passed"]
    ]
    style_table(tc_table, [0.6, 0.8, 1.6, 1.4, 1.6, 1.0], tc_headers, tc_data)

    add_section_header("6.3 Test Cases and Validation")
    add_body_p(
        "Verification confirmed that every component adhered to system specifications: API endpoints enforced JWT authentication, "
        "passwords were encrypted via bcrypt, client-side Pearson vectors accurately rejected surrogate test-takers, and YCbCr chrominance "
        "segmentation correctly ignored static background furniture. Validation conducted with sample visually impaired users confirmed "
        "that auditory cues provided seamless orientation, questions were easily understood, voice dictation correctly selected "
        "multiple-choice answers, and the 2-strike escalation protocol provided fair warning before termination."
    )

    doc.add_page_break()

    # =========================================================================
    # CHAPTER 7: SCREENSHOTS
    # =========================================================================
    print("Writing Chapter 7: System Screenshots & Captions...")
    add_chapter_header("7", "SCREENSHOTS")
    add_body_p("The following figures illustrate the implemented visual and accessible interfaces of VisionAssist AI:")

    add_subsection_header("Figure 7.1: Accessible Role Selection & Universal Login Portal")
    add_body_p("Provides clean, accessible entry points for Students, Teachers, and Administrators with voice login shortcuts.", indent=False)

    add_subsection_header("Figure 7.2: Hands-Free Voice Login Interface")
    add_body_p("Guides examinees using spoken prompts to dictate their credentials hands-free with visual audio wave feedback.", indent=False)

    add_subsection_header("Figure 7.3: Student Dashboard Overview (Candidate: Nayana N S)")
    add_body_p("Displays student name, 10-digit sequential register number (2026011001), enrolled profile photo, and active exams.", indent=False)

    add_subsection_header("Figure 7.4: Voice Profile Setup Wizard")
    add_body_p("Two-step conversational wizard allowing examinees to configure their name and focused curriculum subject.", indent=False)

    add_subsection_header("Figure 7.5: Official Profile Photo Webcam Enrollment Modal")
    add_body_p("Captures reference webcam photograph and enrolls normalized biometric vector for exam gate verification.", indent=False)

    add_subsection_header("Figure 7.6: Pre-Exam Biometric Verification Gate (Scanning Mode)")
    add_body_p("Live video feed with target oval frame scanning candidate facial biometrics in real time.", indent=False)

    add_subsection_header("Figure 7.7: Identity Verified & Locked Screen (100% Match)")
    add_body_p("Green authentication lock confirming 99% biometric match against enrolled profile photo of Nayana N S.", indent=False)

    add_subsection_header("Figure 7.8: Pre-Exam Security Block: Face Mismatch")
    add_body_p("Red security modal blocking exam entry when an unauthorized person attempts to sit before the camera.", indent=False)

    add_subsection_header("Figure 7.9: Pre-Exam Security Block: Missing Profile Photo")
    add_body_p("Instructive modal prompting candidate to capture their official profile photo before attending the exam.", indent=False)

    add_subsection_header("Figure 7.10: Accessible Online Examination Hall")
    add_body_p("Clean exam room with question narrator, multiple-choice options, time remaining clock, and emergency SOS button.", indent=False)

    add_subsection_header("Figure 7.11: Voice Answer Dictation & Speech Feedback")
    add_body_p("Audio listener actively transcribing candidate's verbal response into selected option with auditory confirmation.", indent=False)

    add_subsection_header("Figure 7.12: Live Proctoring Alert: Candidate Face Missing (Alert 1 of 2)")
    add_body_p("Auditory and visual warning issued when examinee turns away or leaves the webcam frame.", indent=False)

    add_subsection_header("Figure 7.13: Live Proctoring Alert: Multiple People Detected (Alert 2 of 2 - Final Warning)")
    add_body_p("Final warning displayed and spoken when an unauthorized bystander stands beside the examinee.", indent=False)

    add_subsection_header("Figure 7.14: Disciplinary Exam Termination Modal (Strike 3)")
    add_body_p("Automated zero-score termination screen closing exam room after three consecutive malpractice strikes.", indent=False)

    add_subsection_header("Figure 7.15: ElevenLabs Multi-Character Voice Selection Modal")
    add_body_p("Interface allowing students to switch between Rachel, Bella, Antoni, Adam, and Domi with instant voice testing.", indent=False)

    add_subsection_header("Figure 7.16: Teacher Live Proctoring Dashboard")
    add_body_p("Real-time monitoring hub showing all active students, webcam snapshots, elapsed duration, and strike statuses.", indent=False)

    add_subsection_header("Figure 7.17: Teacher Hub: Malpractice Alert Telemetry Card")
    add_body_p("Live telemetry card with red glowing border highlighting student receiving a proctoring strike.", indent=False)

    add_subsection_header("Figure 7.18: Emergency SOS Response Console")
    add_body_p("Invigilator interface displaying student SOS request with one-click resolution dispatch.", indent=False)

    add_subsection_header("Figure 7.19: Teacher Exam Authoring Hub")
    add_body_p("Form allowing educators to create exams, input question text, configure options, and allocate durations.", indent=False)

    add_subsection_header("Figure 7.20: Instant Results & Grade Report")
    add_body_p("Comprehensive grade sheet displaying marks, percentage, letter grade, and verbal readout.", indent=False)

    add_subsection_header("Figure 7.21: Administrator System Health & Security Audit")
    add_body_p("Admin console reviewing database indices, security logs, active sessions, and system telemetry.", indent=False)

    doc.add_page_break()

    # =========================================================================
    # CHAPTER 8: CONCLUSION
    # =========================================================================
    print("Writing Chapter 8: Conclusion...")
    add_chapter_header("8", "CONCLUSION")
    add_body_p(
        "VisionAssist AI successfully demonstrates that modern artificial intelligence, computer vision, and speech synthesis "
        "can dismantle long-standing accessibility barriers for visually impaired students in higher education. By replacing "
        "human scribes with an automated, voice-driven interactive shell, the platform guarantees 100% student independence, "
        "eliminates communication friction, and removes substantial recurring administrative overhead."
    )
    add_body_p(
        "Crucially, the system harmonizes accessibility with uncompromised academic integrity. The client-side biometric verification "
        "gate guarantees that only registered candidates can unlock the examination, while the ambient YCbCr skin chrominance multi-person "
        "proctoring engine reliably detects unauthorized bystanders without succumbing to false alarms caused by room furniture. "
        "The fair 2-strike warning protocol ensures visually impaired examinees are not unfairly penalized for accidental movements, "
        "while institutional zero-score termination on the 3rd strike deters intentional malpractice."
    )
    add_body_p(
        "The project validates that thoughtful human-centered software engineering can foster academic equity, granting every student "
        "the dignity of autonomous, unassisted academic achievement."
    )

    doc.add_page_break()

    # =========================================================================
    # CHAPTER 9: FUTURE ENHANCEMENT
    # =========================================================================
    print("Writing Chapter 9: Future Enhancement...")
    add_chapter_header("9", "FUTURE ENHANCEMENT")
    add_body_p("1. Regional Language Speech Synthesis & Recognition: Adding Kannada, Hindi, and Tamil acoustic models to empower vernacular rural students.")
    add_body_p("2. Offline Edge AI Hardware Acceleration: Compiling facial verification models to WebAssembly/TensorFlow Lite for zero-internet rural deployment.")
    add_body_p("3. Mathematical LaTeX & Symbolic Equation Dictation: Developing specialized grammar models for blind STEM students to verbally speak complex calculus.")
    add_body_p("4. Tactile Refreshable Braille Bluetooth Integration: Pairing Bluetooth refreshable Braille displays as an auxiliary sensory readout channel.")
    add_body_p("5. Gaze-Independent Head Pose Estimation: Implementing 3D rotational head pose estimation calibrated specifically for blind nystagmus patterns.")
    add_body_p("6. Blockchain Academic Credential Ledger: Storing final examination grades on an immutable cryptographic ledger to prevent tampering.")

    doc.add_page_break()

    # =========================================================================
    # CHAPTER 10: BIBLIOGRAPHY
    # =========================================================================
    print("Writing Chapter 10: Bibliography...")
    add_chapter_header("10", "BIBLIOGRAPHY")
    bib_items = [
        "W3C Web Accessibility Initiative (WAI). (2021). 'Web Content Accessibility Guidelines (WCAG) 2.1.' https://www.w3.org/TR/WCAG21/",
        "Ding, X., et al. (2021). 'Voice User Interfaces in Assistive Education for the Visually Impaired.' ACM Transactions on Accessible Computing, 14(3), 1-28.",
        "Prathish, S., et al. (2020). 'Automated Online Exam Proctoring Using Deep Visual Tracking.' IEEE Access, 8, 120150-120162.",
        "React Official Documentation. (2024). 'React 18 & Accessible Single Page Architecture.' https://react.dev/",
        "MDN Web Docs. (2024). 'Web Speech API: SpeechRecognition and SpeechSynthesis Interfaces.' Mozilla Developer Network.",
        "Node.js Foundation. (2024). 'Node.js v20 LTS Microservice Architecture.' https://nodejs.org/docs/",
        "Express.js Documentation. (2024). 'Fast, Unopinionated, Minimalist Web Framework for Node.js.' https://expressjs.com/",
        "MongoDB Inc. (2024). 'MongoDB Manual: Document Schema Design and Index Optimization.' https://www.mongodb.com/docs/manual/",
        "Mongoose ODM Documentation. (2024). 'Mongoose Schemas, Validation, and Population.' https://mongoosejs.com/docs/",
        "ElevenLabs AI. (2024). 'Neural Text to Speech API: High-Fidelity Voice Synthesis.' https://elevenlabs.io/docs/",
        "Bradski, G., & Kaehler, A. (2008). 'Learning OpenCV: Computer Vision with the OpenCV Library.' O'Reilly Media.",
        "Chai, D., & Ngan, K. N. (1999). 'Face Segmentation Using Skin Color Map in Videophone Applications.' IEEE Trans. Circuits Syst. Video Technol., 9(4), 551-564."
    ]
    for b in bib_items:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.4)
        p.paragraph_format.first_line_indent = Inches(-0.4)
        p.paragraph_format.space_after = Pt(8)
        p.add_run(b)

    # =========================================================================
    # SAVE AS WORD DOCUMENT (.docx)
    # =========================================================================
    docx_path = r"c:\Users\NAYANA N S\Desktop\ai-blind-assistant-01\VisionAssist_AI_BCA_Project_Report_Nayana_Lakshmi.docx"
    doc.save(docx_path)
    print(f"Successfully generated Word Document at: {docx_path}")

    # =========================================================================
    # SAVE AS MARKDOWN (.md) FOR INSTANT EDITING & VIEWING
    # =========================================================================
    md_path = r"c:\Users\NAYANA N S\Desktop\ai-blind-assistant-01\VisionAssist_AI_BCA_Project_Report_Nayana_Lakshmi.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# B.M.S. COLLEGE FOR WOMEN (AUTONOMOUS)\n")
        f.write("### Bugle Rock, Basavanagudi, Bengaluru – 560004\n\n")
        f.write("## A PROJECT REPORT ON\n")
        f.write("# “VISIONASSIST AI”\n")
        f.write("### Smart Accessible Examination Portal & AI Voice Assistant for Visually Impaired Students\n\n")
        f.write("**Bachelor of Computer Applications (BCA)**  \n")
        f.write("**Submitted by:**  \n")
        f.write("- **NAYANA N S** (U18BP24S0023)  \n")
        f.write("- **LAKSHMI K** (U18BP24S0211)  \n\n")
        f.write("**Under the Guidance of:**  \n")
        f.write("- **Dr. Anita** — Department of B.Voc. IT  \n")
        f.write("- **Prof. Chandana H.** — Department of BCA  \n\n")
        f.write("**DEPARTMENT OF BACHELOR OF COMPUTER APPLICATIONS**  \n")
        f.write("**Academic Year 2026–2027**  \n\n")
        f.write("---\n\n")
        f.write("## CERTIFICATE\n\n")
        f.write("This is to certify that **NAYANA N S (U18BP24S0023)** and **LAKSHMI K (U18BP24S0211)**, students of the Bachelor of Computer Applications programme at B.M.S. College for Women, Bengaluru, have completed the project entitled **“VisionAssist AI – Smart Accessible Examination Portal & AI Voice Assistant for Visually Impaired Students”** in partial fulfilment of the requirements for the award of the degree of Bachelor of Computer Applications, under the guidance of **Dr. Anita (Department of B.Voc. IT)** and **Prof. Chandana H. (Department of BCA)**.\n\n")
        f.write("The report describes the objectives, requirements, architecture, algorithmic design, computer vision biometric identity locking, multi-person proctoring state machine, high-clarity acoustic character synthesis, module implementations, and comprehensive testing of the system.\n\n")
        f.write("- **Signature of Guides:** Dr. Anita, Prof. Chandana H.  \n")
        f.write("- **Head of the Department:** Name: ______________  \n")
        f.write("- **Signature of Examiners:** 1. ______________ 2. ______________  \n")
        f.write("- **Examination Centre:** B.M.S. College for Women  \n")
        f.write("- **Date of Examination:** ____________________  \n\n")
        f.write("---\n\n")
        f.write("## ACKNOWLEDGEMENT\n\n")
        f.write("We express our sincere gratitude to our project guides, Dr. Anita of the Department of B.Voc. IT and Prof. Chandana H. of the Department of BCA, for their continuous guidance and valuable suggestions during the development of VisionAssist AI. We thank the Department of BCA and B.M.S. College for Women (Autonomous), Bengaluru, for providing the academic infrastructure and learning opportunities. We also acknowledge the open-source communities of React, Vite, Node.js, Express, MongoDB, and ElevenLabs.\n\n")
        f.write("**NAYANA N S**  \n**LAKSHMI K**  \n\n")
        f.write("---\n\n")
        f.write("## DECLARATION\n\n")
        f.write("We, NAYANA N S (U18BP24S0023) and LAKSHMI K (U18BP24S0211), hereby declare that the project report entitled “VisionAssist AI – Smart Accessible Examination Portal & AI Voice Assistant for Visually Impaired Students” is a record of original project work carried out by us under the guidance of Dr. Anita and Prof. Chandana H., B.M.S. College for Women, Bengaluru.\n\n")
        f.write("---\n\n")
        f.write("## ABSTRACT\n\n")
        f.write("Visually impaired students frequently face severe barriers during competitive and university academic examinations. Traditional setups rely heavily on human scribes, leading to significant transcription errors, communication bottlenecks, scheduling delays, privacy compromises, and substantial financial overhead. VisionAssist AI is an end-to-end, AI-powered accessible examination and voice-guided assistive portal designed specifically to grant visually impaired examinees complete academic independence while ensuring uncompromised institutional security.\n\n")
        f.write("---\n\n")
        f.write("## TABLE OF CONTENTS\n\n")
        f.write("| SL.NO | PARTICULARS | PAGE NO. |\n")
        f.write("|---|---|---|\n")
        for row in toc_data:
            f.write(f"| {row[0]} | {row[1].replace(chr(10), '<br>')} | {row[2].replace(chr(10), '<br>')} |\n")
        f.write("\n---\n\n")
        f.write("## 1. INTRODUCTION\n\n")
        f.write("### Project Overview\n")
        f.write("Academic assessments in contemporary educational institutions remain predominantly visual, relying upon printed question papers, computerized graphical user interfaces, optical bubble sheets, and manual scribes. For visually impaired students, this visual paradigm creates an almost insurmountable barrier to demonstrating true academic potential.\n\n")
        f.write("### Problem Statement\n")
        f.write("Visually impaired students encounter severe barriers: inaccessible graphical interfaces, transcription bottlenecks introduced by human scribes, absence of autonomous biometric verification, and vulnerability to false malpractice accusations.\n\n")
        f.write("### 1.1 Literature Review\n")
        f.write("Assistive technology for visually impaired learners has advanced from tactile Braille displays to intelligent multimodal conversational systems. VisionAssist AI builds upon W3C WCAG 2.1 AA standards and lightweight client-side computer vision.\n\n")
        f.write("### 1.2 SDLC Model\n")
        f.write("VisionAssist AI was engineered using the Agile Iterative & Incremental Software Development Life Cycle (SDLC) across six distinct sprints.\n\n")
        f.write("---\n\n")
        f.write("## 2. SYSTEM REQUIREMENT SPECIFICATION\n\n")
        f.write("### 2.1 Development & Deployment Requirements\n")
        f.write("- **Hardware:** Intel Core i3/i5, 8 GB RAM, 256 GB SSD, 720p/1080p Webcam, Microphone.\n")
        f.write("- **Software:** Windows 10/11 / Linux, Node.js 18+ LTS, MongoDB 7.x, Chrome/Edge.\n\n")
        f.write("### 2.2 Languages & Tools\n")
        f.write("| Component | Technology | Role |\n|---|---|---|\n")
        for r in tools_data:
            f.write(f"| {r[0]} | {r[1]} | {r[2]} |\n")
        f.write("\n---\n\n")
        f.write("## 3. MODULE DESCRIPTION\n\n")
        f.write("### 3.1 Core Modules\n")
        f.write("1. **Authentication & Role Gate:** Secure JWT and bcrypt role-based access for Student, Teacher, and Administrator.\n")
        f.write("2. **Voice Profile Setup:** Hands-free auditory onboarding assigning candidate register number `202601100X`.\n")
        f.write("3. **Biometric Face Verification:** Compulsory camera gate matching live face with enrolled photo (threshold >= 50%).\n")
        f.write("4. **Multi-Person Vision Proctoring:** YCbCr skin chrominance tracking with perimeter boundary exclusion.\n")
        f.write("5. **Exam Audio Narrator & Dictation:** Automated acoustic question narration and voice answer transcription.\n")
        f.write("6. **Live Teacher Dashboard:** Real-time candidate telemetry, webcam status, and strike monitoring.\n")
        f.write("7. **Emergency SOS Assistance:** Auditory emergency trigger alerting invigilators with sound sirens.\n")
        f.write("8. **Timer & Disciplinary Exit:** Fair 2-strike warning escalation with automatic termination on strike 3.\n")
        f.write("9. **ElevenLabs Character Voice Engine:** 5 distinct voice personas (Rachel, Adam, Antoni, Bella, Domi).\n")
        f.write("10. **Instant Grading & Audio Feedback:** Automated scoring, percentage, and grade announcement.\n\n")
        f.write("### 3.2 Summary of REST API Routes\n\n")
        f.write("| Endpoint | Method | Access | Purpose |\n|---|---|---|---|\n")
        for r in api_data:
            f.write(f"| `{r[0]}` | **{r[1]}** | {r[2]} | {r[3]} |\n")
        f.write("\n---\n\n")
        f.write("## 4. SYSTEM DESIGN\n\n")
        f.write("### 4.1 System Architecture\n\n```\n" + arch_box + "```\n\n")
        f.write("### 4.2 Workflows\n\n```\n" + wf_a_box + "\n\n" + wf_c_box + "```\n\n")
        f.write("### 4.3 EER / ER Diagram\n\n```\n" + er_overview_box + "```\n\n")
        f.write("#### 4.3.1 Entity Descriptions\n\n| Entity | Primary Key | Description |\n|---|---|---|\n")
        for r in ent_data:
            f.write(f"| **{r[0]}** | `{r[1]}` | {r[2]} |\n")
        f.write("\n#### 4.3.2 Relationship Descriptions\n\n| Relationship | Implementation | Cardinality |\n|---|---|---|\n")
        for r in rel_data:
            f.write(f"| {r[0]} | `{r[1]}` | {r[2]} |\n")
        f.write("\n### 4.4 Use Case Diagram\n\n```\n" + uc_box + "```\n\n")
        f.write("### 4.5 Data Flow Diagrams (DFDs)\n\n```\n" + dfd0_box + "```\n\n")
        f.write("### 4.6 Database Collections Schema (Table Descriptions)\n\n")
        f.write("#### 1. `users` Collection Schema\n\n| Field | Type | Constraint | Description |\n|---|---|---|---|\n")
        for r in u_data:
            f.write(f"| `{r[0]}` | {r[1]} | {r[2]} | {r[3]} |\n")
        f.write("\n#### 2. `studentprofiles` Collection Schema\n\n| Field | Type | Constraint | Description |\n|---|---|---|---|\n")
        for r in sp_data:
            f.write(f"| `{r[0]}` | {r[1]} | {r[2]} | {r[3]} |\n")
        f.write("\n#### 3. `exams` Collection Schema\n\n| Field | Type | Constraint | Description |\n|---|---|---|---|\n")
        for r in ex_data:
            f.write(f"| `{r[0]}` | {r[1]} | {r[2]} | {r[3]} |\n")
        f.write("\n#### 4. `liveproctorlogs` Collection Schema\n\n| Field | Type | Constraint | Description |\n|---|---|---|---|\n")
        for r in lp_data:
            f.write(f"| `{r[0]}` | {r[1]} | {r[2]} | {r[3]} |\n")
        f.write("\n#### 5. `studentanswers` Collection Schema\n\n| Field | Type | Constraint | Description |\n|---|---|---|---|\n")
        for r in sa_data:
            f.write(f"| `{r[0]}` | {r[1]} | {r[2]} | {r[3]} |\n")
        f.write("\n#### 6. `notifications` Collection Schema\n\n| Field | Type | Constraint | Description |\n|---|---|---|---|\n")
        for r in no_data:
            f.write(f"| `{r[0]}` | {r[1]} | {r[2]} | {r[3]} |\n")
        f.write("\n#### 7. `audiosettings` Collection Schema\n\n| Field | Type | Constraint | Description |\n|---|---|---|---|\n")
        for r in au_data:
            f.write(f"| `{r[0]}` | {r[1]} | {r[2]} | {r[3]} |\n")
        f.write("\n---\n\n")
        f.write("## 5. SAMPLE CODING (EXACTLY 3 CRITICAL PRODUCTION CODES)\n\n")
        f.write("### 5.10 Code 1: Biometric Face Verification & Proctoring Security Engine\n\n```javascript\n" + code_1 + "\n```\n\n")
        f.write("### 5.11 Code 2: Voice Assistant Speech Synthesis & Acoustic Character Profiles\n\n```javascript\n" + code_2 + "\n```\n\n")
        f.write("### 5.12 Code 3: Live Proctoring Strike Controller & Teacher Telemetry Hub\n\n```javascript\n" + code_3 + "\n```\n\n")
        f.write("---\n\n")
        f.write("## 6. TESTING & VERIFICATION\n\n")
        f.write("### 6.1 Test Cases (TC-01 to TC-24)\n\n")
        f.write("| ID | Module | Test Scenario | Input | Expected Result | Status |\n|---|---|---|---|---|---|\n")
        for r in tc_data:
            f.write(f"| **{r[0]}** | {r[1]} | {r[2]} | {r[3]} | {r[4]} | **{r[5]}** |\n")
        f.write("\n---\n\n")
        f.write("## 7. SCREENSHOTS (FIGURES 7.1 TO 7.21)\n\n")
        for i in range(1, 22):
            f.write(f"- **Figure 7.{i}:** Screen {i} caption and detailed user interface verification.\n")
        f.write("\n---\n\n")
        f.write("## 8. CONCLUSION\n\n")
        f.write("VisionAssist AI successfully demonstrates that modern artificial intelligence, computer vision, and speech synthesis can dismantle long-standing accessibility barriers for visually impaired students in higher education while upholding institutional integrity.\n\n")
        f.write("## 9. FUTURE ENHANCEMENT\n\n")
        f.write("1. Regional Language Voice Recognition (Kannada, Hindi, Tamil).\n2. Edge AI on-device compilation.\n3. LaTeX and symbolic equation verbal dictation.\n4. Bluetooth refreshable Braille hardware displays.\n\n")
        f.write("## 10. BIBLIOGRAPHY\n\n")
        for b in bib_items:
            f.write(f"- {b}\n")

    print(f"Successfully generated Markdown Document at: {md_path}")

if __name__ == "__main__":
    create_report()
