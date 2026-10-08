-- Demo training programs (idempotent). Remove or edit via Admin → Training Programs.
INSERT INTO training_programs (id, slug, title, short_description, duration_min, delivery_formats, min_participants, max_participants, target_audience, sort_order) VALUES
 ('pharma-marketing-sales','pharma-marketing-sales','AI for Pharmaceutical Marketing & Sales','Practical AI for pharma sales forecasting, customer segmentation and promotion.',360,'{online,onsite,hybrid}',5,50,'Pharma sales & marketing teams',0),
 ('medical-professionals','medical-professionals','AI for Medical Professionals','Safe, evidence-aware use of AI in clinical research, documentation and patient communication.',240,'{online,onsite,hybrid}',5,40,'Doctors, clinicians, medical educators',1),
 ('procurement-compliance','procurement-compliance','AI for Procurement & Compliance','Contract review, vendor analysis and compliance monitoring with AI.',240,'{online,onsite,hybrid}',5,50,'Procurement, legal and compliance teams',2),
 ('genai-business','genai-business','Generative AI for Business Professionals','Hands-on generative AI for everyday productivity, writing, analysis and decisions.',180,'{online,onsite,hybrid}',5,60,'Managers and business professionals',3),
 ('ai-agents-workshop','ai-agents-workshop','AI Agent Automation Workshop','Design and deploy AI agents that automate real business workflows.',360,'{online,onsite,hybrid}',5,25,'Technical leads, analysts, operations',4),
 ('data-analytics','data-analytics','AI for Data Analytics','From spreadsheets to insight: AI-assisted analysis, visualisation and reporting.',300,'{online,onsite,hybrid}',5,30,'Analysts and data-driven teams',5),
 ('custom-corporate','custom-corporate','Custom Corporate AI Training','A programme designed around your organisation, audience and objectives.',480,'{online,onsite,hybrid}',1,500,'Any organisation',6)
ON CONFLICT (id) DO NOTHING;
