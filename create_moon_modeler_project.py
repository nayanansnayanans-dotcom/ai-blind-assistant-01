# create_moon_modeler_project.py
import json
import uuid
import os
import shutil

def uid():
    return str(uuid.uuid4())

def make_col(name, datatype, pk=False, fk=False, nn=True, comment="", param=""):
    return {
        "id": uid(),
        "name": name,
        "datatype": datatype,
        "pk": pk,
        "fk": fk,
        "nn": nn,
        "list": False,
        "param": param,
        "comment": comment,
        "enum": "",
        "validation": "",
        "pattern": False,
        "estimatedSize": "",
        "data": "",
        "any": ""
    }

def build_model():
    # Model IDs
    model_id = "53956e21-7bec-4313-9966-3a384c217302"
    diagram_id = "0933eed4-01d0-4b34-b2f9-1dd0f22ce542"
    
    # 1. USERS COLLECTION
    user_id = "94dcaf55-a9e3-4709-bd22-739249cf9694"
    u_pk = make_col("_id", "objectId", pk=True, nn=True)
    u_username = make_col("username", "string", nn=True)
    u_email = make_col("email", "string", nn=True)
    u_phone = make_col("phone", "string", nn=False)
    u_password = make_col("password", "string", nn=True)
    u_role = make_col("role", "string", nn=True, comment="student | teacher | admin | user")
    u_studentId = make_col("studentId", "string", nn=False)
    u_course = make_col("course", "string", nn=False)
    u_subject = make_col("subject", "string", nn=False)
    u_interested = make_col("interestedSubject", "string", nn=False)
    u_created = make_col("createdAt", "date", nn=True)
    u_updated = make_col("updatedAt", "date", nn=True)
    u_v = make_col("__v", "double", nn=False)

    user_cols = [u_pk, u_username, u_email, u_phone, u_password, u_role, u_studentId, u_course, u_subject, u_interested, u_created, u_updated, u_v]
    user_pk_key_id = uid()

    # 2. EXAMS COLLECTION
    exam_id = "3a500275-77d0-42eb-9b6d-a24b530259f0"
    e_pk = make_col("_id", "objectId", pk=True, nn=True)
    e_title = make_col("title", "string", nn=True)
    e_subject = make_col("subject", "string", nn=True)
    e_duration = make_col("durationMinutes", "int", nn=True)
    e_date = make_col("date", "string", nn=False)
    e_startTime = make_col("startTime", "string", nn=False)
    e_passing = make_col("passingMarks", "int", nn=False)
    e_instructions = make_col("instructions", "string", nn=False)
    e_status = make_col("status", "string", nn=True, comment="Draft | Scheduled | Published | Completed")
    e_assigned = make_col("assignedStudents", "array", nn=False, param="string")
    e_targetEmail = make_col("targetStudentEmail", "string", nn=False)
    e_targetName = make_col("targetStudentName", "string", nn=False)
    e_createdBy = make_col("createdBy", "objectId", fk=True, nn=True, comment="Ref: users._id")
    e_creatorEmail = make_col("creatorEmail", "string", nn=False)
    e_teacherEmail = make_col("teacherEmail", "string", nn=False)
    e_questions = make_col("questions", "array", nn=True, comment="Embedded Question Documents")
    e_createdAt = make_col("createdAt", "date", nn=True)

    exam_cols = [e_pk, e_title, e_subject, e_duration, e_date, e_startTime, e_passing, e_instructions, e_status, e_assigned, e_targetEmail, e_targetName, e_createdBy, e_creatorEmail, e_teacherEmail, e_questions, e_createdAt]
    exam_pk_key_id = uid()

    # 3. EMBEDDED QUESTIONS (Subdocument)
    sub_q_id = uid()
    q_num = make_col("questionNumber", "int", nn=True)
    q_text = make_col("questionText", "string", nn=True)
    q_type = make_col("questionType", "string", nn=True, comment="MCQ | Descriptive | Voice")
    q_marks = make_col("marks", "int", nn=True)
    q_diff = make_col("difficulty", "string", nn=False)
    q_opts = make_col("options", "array", nn=False, param="string")
    q_ans = make_col("correctAnswer", "string", nn=False)
    sub_q_cols = [q_num, q_text, q_type, q_marks, q_diff, q_opts, q_ans]

    # 4. RESULTS COLLECTION
    result_id = uid()
    r_pk = make_col("_id", "objectId", pk=True, nn=True)
    r_studentId = make_col("studentId", "objectId", fk=True, nn=True, comment="Ref: users._id")
    r_studentName = make_col("studentName", "string", nn=True)
    r_examId = make_col("examId", "objectId", fk=True, nn=True, comment="Ref: exams._id")
    r_examTitle = make_col("examTitle", "string", nn=True)
    r_examLang = make_col("examLanguage", "string", nn=False)
    r_score = make_col("score", "int", nn=True, comment="Raw Marks Awarded")
    r_totalMarks = make_col("totalMarks", "int", nn=True)
    r_pct = make_col("percentage", "int", nn=True, comment="100% Scale Score")
    r_grade = make_col("grade", "string", nn=True, comment="A+, A, B+, B, C, D, F")
    r_feedback = make_col("feedback", "string", nn=False, comment="Teacher Evaluation Remarks")
    r_answersLog = make_col("answersLog", "array", nn=True, comment="Embedded Student Answer Responses")
    r_submittedAt = make_col("submittedAt", "date", nn=True)

    result_cols = [r_pk, r_studentId, r_studentName, r_examId, r_examTitle, r_examLang, r_score, r_totalMarks, r_pct, r_grade, r_feedback, r_answersLog, r_submittedAt]
    result_pk_key_id = uid()

    # 5. EMBEDDED ANSWERS_LOG (Subdocument)
    sub_ans_id = uid()
    ans_idx = make_col("questionIndex", "int", nn=True)
    ans_text = make_col("questionText", "string", nn=True)
    ans_resp = make_col("studentAnswer", "string", nn=True, comment="Voice Dictated / Typed Response")
    ans_trans = make_col("transcript", "string", nn=False)
    ans_correct = make_col("isCorrect", "bool", nn=True)
    sub_ans_cols = [ans_idx, ans_text, ans_resp, ans_trans, ans_correct]

    # 6. ASSISTANCEREQUESTS COLLECTION
    assist_id = uid()
    a_pk = make_col("_id", "objectId", pk=True, nn=True)
    a_name = make_col("studentName", "string", nn=True)
    a_sid = make_col("studentId", "string", nn=False)
    a_exam = make_col("examTitle", "string", nn=False)
    a_req = make_col("request", "string", nn=True, comment="Emergency SOS / Audio Assist")
    a_type = make_col("type", "string", nn=True, comment="Emergency SOS | Voice Query")
    a_status = make_col("status", "string", nn=True, comment="Pending | Responded | Resolved")
    a_time = make_col("time", "string", nn=False)
    a_created = make_col("createdAt", "date", nn=True)
    assist_cols = [a_pk, a_name, a_sid, a_exam, a_req, a_type, a_status, a_time, a_created]
    assist_pk_key_id = uid()

    # 7. PDFDOCUMENTS COLLECTION
    pdf_id = uid()
    p_pk = make_col("_id", "objectId", pk=True, nn=True)
    p_title = make_col("title", "string", nn=True)
    p_subject = make_col("subject", "string", nn=True)
    p_url = make_col("fileUrl", "string", nn=True)
    p_uploaded = make_col("uploadedAt", "date", nn=True)
    pdf_cols = [p_pk, p_title, p_subject, p_url, p_uploaded]
    pdf_pk_key_id = uid()

    # 8. LOGS COLLECTION
    log_id = uid()
    l_pk = make_col("_id", "objectId", pk=True, nn=True)
    l_feat = make_col("featureUsed", "string", nn=True, comment="voice-assistant | exam-proctoring | ocr")
    l_status = make_col("status", "string", nn=True, comment="success | error | pending")
    l_details = make_col("details", "string", nn=False)
    l_time = make_col("timestamp", "date", nn=True)
    log_cols = [l_pk, l_feat, l_status, l_details, l_time]
    log_pk_key_id = uid()

    # REFERENCES (Relationships)
    # Rel 1: Teacher (users._id) creates Exams (exams.createdBy)
    rel1_id = uid()
    rel1 = {
        "id": rel1_id,
        "name": "rel_exams_users",
        "desc": "Teacher creates Exam",
        "type": "identifying",
        "parent": user_id,
        "parent_key": user_pk_key_id,
        "child": exam_id,
        "cols": [{"id": uid(), "parentcol": u_pk["id"], "childcol": e_createdBy["id"]}],
        "generate": True,
        "generateCustomCode": True,
        "customCode": "",
        "relationColor": "#38bdf8",
        "ri_pd": "na",
        "ri_pu": "na"
    }

    # Rel 2: Student (users._id) attempts Exam Results (results.studentId)
    rel2_id = uid()
    rel2 = {
        "id": rel2_id,
        "name": "rel_results_users",
        "desc": "Student attempts Result",
        "type": "identifying",
        "parent": user_id,
        "parent_key": user_pk_key_id,
        "child": result_id,
        "cols": [{"id": uid(), "parentcol": u_pk["id"], "childcol": r_studentId["id"]}],
        "generate": True,
        "generateCustomCode": True,
        "customCode": "",
        "relationColor": "#22c55e",
        "ri_pd": "na",
        "ri_pu": "na"
    }

    # Rel 3: Exam (exams._id) evaluated in Results (results.examId)
    rel3_id = uid()
    rel3 = {
        "id": rel3_id,
        "name": "rel_results_exams",
        "desc": "Exam evaluated in Result",
        "type": "identifying",
        "parent": exam_id,
        "parent_key": exam_pk_key_id,
        "child": result_id,
        "cols": [{"id": uid(), "parentcol": e_pk["id"], "childcol": r_examId["id"]}],
        "generate": True,
        "generateCustomCode": True,
        "customCode": "",
        "relationColor": "#a855f7",
        "ri_pd": "na",
        "ri_pu": "na"
    }

    tables = {
        user_id: {
            "id": user_id,
            "name": "users",
            "desc": "System Users: Students, Teachers, Admins",
            "collation": "",
            "embeddable": False,
            "cols": user_cols,
            "relations": [rel1_id, rel2_id],
            "keys": [{"id": user_pk_key_id, "name": "Primary key", "isPk": True, "cols": [{"id": uid(), "colid": u_pk["id"]}]}],
            "indexes": [{"id": uid(), "name": "_id_", "cols": [], "mongodb": {"fields": "{\n  \"_id\": 1\n}", "options": ""}}, {"id": uid(), "name": "email_1", "cols": [], "mongodb": {"fields": "{\n  \"email\": 1\n}", "options": "{\n  \"unique\": true\n}"}}],
            "generate": True,
            "generateCustomCode": True,
            "customCode": "",
            "beforeScript": "",
            "afterScript": "",
            "capped": False,
            "others": "",
            "size": "",
            "max": "",
            "validation": "",
            "validationAction": "na",
            "validationLevel": "na",
            "visible": True,
            "lines": []
        },
        exam_id: {
            "id": exam_id,
            "name": "exams",
            "desc": "Online Assessments created by Teachers",
            "collation": "",
            "embeddable": False,
            "cols": exam_cols,
            "relations": [rel1_id, rel3_id],
            "keys": [{"id": exam_pk_key_id, "name": "Primary key", "isPk": True, "cols": [{"id": uid(), "colid": e_pk["id"]}]}],
            "indexes": [{"id": uid(), "name": "_id_", "cols": [], "mongodb": {"fields": "{\n  \"_id\": 1\n}", "options": ""}}],
            "generate": True,
            "generateCustomCode": True,
            "customCode": "",
            "beforeScript": "",
            "afterScript": "",
            "capped": False,
            "others": "",
            "size": "",
            "max": "",
            "validation": "",
            "validationAction": "na",
            "validationLevel": "na",
            "visible": True,
            "lines": []
        },
        sub_q_id: {
            "id": sub_q_id,
            "name": "embedded_questions",
            "desc": "Embedded questions inside exams",
            "collation": "",
            "embeddable": True,
            "cols": sub_q_cols,
            "relations": [],
            "keys": [],
            "indexes": [],
            "generate": True,
            "generateCustomCode": True,
            "customCode": "",
            "beforeScript": "",
            "afterScript": "",
            "capped": False,
            "others": "",
            "size": "",
            "max": "",
            "validation": "",
            "validationAction": "na",
            "validationLevel": "na",
            "visible": True,
            "lines": []
        },
        result_id: {
            "id": result_id,
            "name": "results",
            "desc": "Student Submissions, Performance & Grades",
            "collation": "",
            "embeddable": False,
            "cols": result_cols,
            "relations": [rel2_id, rel3_id],
            "keys": [{"id": result_pk_key_id, "name": "Primary key", "isPk": True, "cols": [{"id": uid(), "colid": r_pk["id"]}]}],
            "indexes": [{"id": uid(), "name": "_id_", "cols": [], "mongodb": {"fields": "{\n  \"_id\": 1\n}", "options": ""}}],
            "generate": True,
            "generateCustomCode": True,
            "customCode": "",
            "beforeScript": "",
            "afterScript": "",
            "capped": False,
            "others": "",
            "size": "",
            "max": "",
            "validation": "",
            "validationAction": "na",
            "validationLevel": "na",
            "visible": True,
            "lines": []
        },
        sub_ans_id: {
            "id": sub_ans_id,
            "name": "embedded_answersLog",
            "desc": "Embedded student responses per question",
            "collation": "",
            "embeddable": True,
            "cols": sub_ans_cols,
            "relations": [],
            "keys": [],
            "indexes": [],
            "generate": True,
            "generateCustomCode": True,
            "customCode": "",
            "beforeScript": "",
            "afterScript": "",
            "capped": False,
            "others": "",
            "size": "",
            "max": "",
            "validation": "",
            "validationAction": "na",
            "validationLevel": "na",
            "visible": True,
            "lines": []
        },
        assist_id: {
            "id": assist_id,
            "name": "assistancerequests",
            "desc": "Student Emergency SOS & Audio Help Inquiries",
            "collation": "",
            "embeddable": False,
            "cols": assist_cols,
            "relations": [],
            "keys": [{"id": assist_pk_key_id, "name": "Primary key", "isPk": True, "cols": [{"id": uid(), "colid": a_pk["id"]}]}],
            "indexes": [{"id": uid(), "name": "_id_", "cols": [], "mongodb": {"fields": "{\n  \"_id\": 1\n}", "options": ""}}],
            "generate": True,
            "generateCustomCode": True,
            "customCode": "",
            "beforeScript": "",
            "afterScript": "",
            "capped": False,
            "others": "",
            "size": "",
            "max": "",
            "validation": "",
            "validationAction": "na",
            "validationLevel": "na",
            "visible": True,
            "lines": []
        },
        pdf_id: {
            "id": pdf_id,
            "name": "pdfdocuments",
            "desc": "Learning Materials & PDFs uploaded by Teachers",
            "collation": "",
            "embeddable": False,
            "cols": pdf_cols,
            "relations": [],
            "keys": [{"id": pdf_pk_key_id, "name": "Primary key", "isPk": True, "cols": [{"id": uid(), "colid": p_pk["id"]}]}],
            "indexes": [{"id": uid(), "name": "_id_", "cols": [], "mongodb": {"fields": "{\n  \"_id\": 1\n}", "options": ""}}],
            "generate": True,
            "generateCustomCode": True,
            "customCode": "",
            "beforeScript": "",
            "afterScript": "",
            "capped": False,
            "others": "",
            "size": "",
            "max": "",
            "validation": "",
            "validationAction": "na",
            "validationLevel": "na",
            "visible": True,
            "lines": []
        },
        log_id: {
            "id": log_id,
            "name": "logs",
            "desc": "Audit, Security & Continuous Proctoring Logs",
            "collation": "",
            "embeddable": False,
            "cols": log_cols,
            "relations": [],
            "keys": [{"id": log_pk_key_id, "name": "Primary key", "isPk": True, "cols": [{"id": uid(), "colid": l_pk["id"]}]}],
            "indexes": [{"id": uid(), "name": "_id_", "cols": [], "mongodb": {"fields": "{\n  \"_id\": 1\n}", "options": ""}}],
            "generate": True,
            "generateCustomCode": True,
            "customCode": "",
            "beforeScript": "",
            "afterScript": "",
            "capped": False,
            "others": "",
            "size": "",
            "max": "",
            "validation": "",
            "validationAction": "na",
            "validationLevel": "na",
            "visible": True,
            "lines": []
        }
    }

    relations = {
        rel1_id: rel1,
        rel2_id: rel2,
        rel3_id: rel3
    }

    # Diagram layout positions on canvas
    diagram_items = {
        user_id: {
            "x": 60, "y": 60, "gHeight": 320, "gWidth": 290,
            "background": "#03a9f4", "color": "#ffffff",
            "referencedItemId": user_id, "resized": True, "autoExpand": True,
            "backgroundOpacity": "10", "collapsed": False, "borderColor": "#666666",
            "borderStyle": "none", "borderWidth": 2, "assetAspectRatio": "none",
            "assetTextPosition": "right", "assetShowText": True, "areaHeaderDisplayed": True,
            "areaHeaderColor": "transparent", "areaHeaderBackground": "transparent", "cardBackground": "transparent"
        },
        exam_id: {
            "x": 440, "y": 60, "gHeight": 380, "gWidth": 310,
            "background": "#f59e0b", "color": "#ffffff",
            "referencedItemId": exam_id, "resized": True, "autoExpand": True,
            "backgroundOpacity": "10", "collapsed": False, "borderColor": "#666666",
            "borderStyle": "none", "borderWidth": 2, "assetAspectRatio": "none",
            "assetTextPosition": "right", "assetShowText": True, "areaHeaderDisplayed": True,
            "areaHeaderColor": "transparent", "areaHeaderBackground": "transparent", "cardBackground": "transparent"
        },
        sub_q_id: {
            "x": 820, "y": 60, "gHeight": 220, "gWidth": 280,
            "background": "#eab308", "color": "#ffffff",
            "referencedItemId": sub_q_id, "resized": True, "autoExpand": True,
            "backgroundOpacity": "10", "collapsed": False, "borderColor": "#666666",
            "borderStyle": "none", "borderWidth": 2, "assetAspectRatio": "none",
            "assetTextPosition": "right", "assetShowText": True, "areaHeaderDisplayed": True,
            "areaHeaderColor": "transparent", "areaHeaderBackground": "transparent", "cardBackground": "transparent"
        },
        result_id: {
            "x": 440, "y": 480, "gHeight": 350, "gWidth": 310,
            "background": "#10b981", "color": "#ffffff",
            "referencedItemId": result_id, "resized": True, "autoExpand": True,
            "backgroundOpacity": "10", "collapsed": False, "borderColor": "#666666",
            "borderStyle": "none", "borderWidth": 2, "assetAspectRatio": "none",
            "assetTextPosition": "right", "assetShowText": True, "areaHeaderDisplayed": True,
            "areaHeaderColor": "transparent", "areaHeaderBackground": "transparent", "cardBackground": "transparent"
        },
        sub_ans_id: {
            "x": 820, "y": 320, "gHeight": 200, "gWidth": 280,
            "background": "#059669", "color": "#ffffff",
            "referencedItemId": sub_ans_id, "resized": True, "autoExpand": True,
            "backgroundOpacity": "10", "collapsed": False, "borderColor": "#666666",
            "borderStyle": "none", "borderWidth": 2, "assetAspectRatio": "none",
            "assetTextPosition": "right", "assetShowText": True, "areaHeaderDisplayed": True,
            "areaHeaderColor": "transparent", "areaHeaderBackground": "transparent", "cardBackground": "transparent"
        },
        assist_id: {
            "x": 60, "y": 430, "gHeight": 260, "gWidth": 290,
            "background": "#ef4444", "color": "#ffffff",
            "referencedItemId": assist_id, "resized": True, "autoExpand": True,
            "backgroundOpacity": "10", "collapsed": False, "borderColor": "#666666",
            "borderStyle": "none", "borderWidth": 2, "assetAspectRatio": "none",
            "assetTextPosition": "right", "assetShowText": True, "areaHeaderDisplayed": True,
            "areaHeaderColor": "transparent", "areaHeaderBackground": "transparent", "cardBackground": "transparent"
        },
        pdf_id: {
            "x": 60, "y": 730, "gHeight": 180, "gWidth": 290,
            "background": "#8b5cf6", "color": "#ffffff",
            "referencedItemId": pdf_id, "resized": True, "autoExpand": True,
            "backgroundOpacity": "10", "collapsed": False, "borderColor": "#666666",
            "borderStyle": "none", "borderWidth": 2, "assetAspectRatio": "none",
            "assetTextPosition": "right", "assetShowText": True, "areaHeaderDisplayed": True,
            "areaHeaderColor": "transparent", "areaHeaderBackground": "transparent", "cardBackground": "transparent"
        },
        log_id: {
            "x": 440, "y": 870, "gHeight": 180, "gWidth": 310,
            "background": "#ec4899", "color": "#ffffff",
            "referencedItemId": log_id, "resized": True, "autoExpand": True,
            "backgroundOpacity": "10", "collapsed": False, "borderColor": "#666666",
            "borderStyle": "none", "borderWidth": 2, "assetAspectRatio": "none",
            "assetTextPosition": "right", "assetShowText": True, "areaHeaderDisplayed": True,
            "areaHeaderColor": "transparent", "areaHeaderBackground": "transparent", "cardBackground": "transparent"
        }
    }

    project_json = {
        "tables": tables,
        "relations": relations,
        "notes": {},
        "lines": {},
        "model": {
            "activeDiagram": diagram_id,
            "desc": "Enhanced Entity-Relationship (EER) Conceptual and Logical Architecture for VoiceAssist AI Proctored Examination System",
            "name": "ai_blind_assistant",
            "id": model_id,
            "path": "",
            "type": "MONGODB",
            "appName": "MoonModeler",
            "subType": "",
            "version": 1,
            "parentTableInFkCols": True,
            "caseConvention": "under",
            "replaceSpace": "_",
            "color": "transparent",
            "sideSelections": True,
            "isDirty": False,
            "storedin": {"major": 0, "minor": 0, "extra": 0},
            "laststoredin": {"major": 0, "minor": 0, "extra": 0},
            "def_collation": "",
            "def_coltopk": True,
            "def_others": "",
            "filePath": "",
            "lastSaved": "",
            "writeFileParam": False,
            "authorName": "Nayana N S",
            "companyDetails": "Department of Computer Science & Engineering",
            "companyUrl": "",
            "def_validationAction": "na",
            "def_validationLevel": "na",
            "connectionId": "14e43acf-7c0b-43ef-9584-ffa9d2b36076",
            "connectionVersion": "N/A",
            "migrateDefaultValue": False
        },
        "otherObjects": {},
        "diagrams": {
            diagram_id: {
                "id": diagram_id,
                "lineColor": "transparent",
                "description": "Main Conceptual & Logical EER Diagram",
                "diagramItems": diagram_items,
                "diagramLinks": {
                    rel1_id: {"referencedItemId": rel1_id, "color": "#38bdf8", "style": "solid", "lineWidth": 2},
                    rel2_id: {"referencedItemId": rel2_id, "color": "#22c55e", "style": "solid", "lineWidth": 2},
                    rel3_id: {"referencedItemId": rel3_id, "color": "#a855f7", "style": "solid", "lineWidth": 2}
                },
                "isOpen": True,
                "main": True,
                "name": "Main Diagram",
                "keysgraphics": False,
                "linegraphics": "detailed",
                "zoom": 1,
                "background": "transparent",
                "scroll": {"x": 0, "y": 0},
                "type": "erd",
                "showEstimatedSize": False,
                "showSchemaContainer": False,
                "showEmbeddedInParents": True,
                "showCardinalityCaptions": True,
                "showRelationshipNames": True,
                "showLineCaptions": True,
                "showDependencyCaptions": False,
                "showColumns": True,
                "showColumnDataTypes": True,
                "showSampleData": False,
                "showTableIndexes": False,
                "showKeys": True,
                "showCheckConstraints": False,
                "showTableDescriptions": False,
                "showRelations": True,
                "showLines": True,
                "showDependencies": True,
                "showHorizontal": False,
                "showDescriptions": True,
                "showIndicators": False,
                "showProgress": False,
                "showIndicatorCaptions": False,
                "backgroundImage": "na",
                "descriptionsColor": "transparent",
                "boxSize": "0",
                "boxSpacing": "2",
                "boxAlign": "center",
                "lineWidth": "2",
                "embeddedSpacing": "2",
                "showLabels": True,
                "showMainIcon": True,
                "showCustomizations": False,
                "showExportDimensions": False,
                "showCompleted": True,
                "showAnimations": False,
                "showTriggers": False,
                "showViewColumns": False,
                "showOtherObjectDetails": False
            }
        },
        "diagramsOrder": [diagram_id],
        "order": [user_id, exam_id, sub_q_id, result_id, sub_ans_id, assist_id, pdf_id, log_id],
        "collapsedTreeItems": [],
        "reverseStats": {}
    }

    # 1. Save in project workspace as .dmm
    project_dmm = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ai_blind_assistant.dmm")
    with open(project_dmm, "w", encoding="utf-8") as f:
        json.dump(project_json, f, indent=2)
    print("Created Moon Modeler Project file in Workspace: " + project_dmm)

if __name__ == "__main__":
    build_model()
