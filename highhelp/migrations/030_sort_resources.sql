-- Sort the resources that 029_resource_folders.sql put in each subject's Unfiled folder.
-- One-off for production data: every statement matches a note by id AND file_key, so on any
-- other database (local dev, tests) it changes nothing. Notes in Removed are left where they are.
-- Year 11 subjects stay in Unfiled (some grouped into a sub-folder); HSC courses go into the
-- section of the assessment they were made for. Some notes also move to the subject they belong to.

-- New folders.
INSERT INTO resource_folders (parent_id, name, kind, access, creator_id)
SELECT (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Biology' AND s.kind = 'section' AND s.name = 'Unfiled'), 'Anki Flashcards', 'folder', 'everyone', (SELECT id FROM users WHERE id = 3)
WHERE EXISTS (SELECT 1 FROM resources WHERE id = 30 AND file_key = 'resources/1776061446051-Biology_T1.apkg');
INSERT INTO resource_folders (parent_id, name, kind, access, creator_id)
SELECT (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Economics' AND s.kind = 'section' AND s.name = 'Unfiled'), 'Anki Flashcards', 'folder', 'everyone', (SELECT id FROM users WHERE id = 3)
WHERE EXISTS (SELECT 1 FROM resources WHERE id = 4 AND file_key = 'resources/1771039928150-Economics__Ch_1_The_economic_problem.apkg');
INSERT INTO resource_folders (parent_id, name, kind, access, creator_id)
SELECT (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Business Studies (HSC)' AND s.kind = 'section' AND s.name = 'Task 1'), 'Marketing Notes', 'folder', 'everyone', (SELECT id FROM users WHERE id = 3)
WHERE EXISTS (SELECT 1 FROM resources WHERE id = 16 AND file_key = 'resources/1771914727922-Marketing_Role.md');
INSERT INTO resource_folders (parent_id, name, kind, access, creator_id)
SELECT (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 2U (HSC)' AND s.kind = 'section' AND s.name = 'Task 1'), 'Math A Class Notes', 'folder', 'everyone', (SELECT id FROM users WHERE id = 3)
WHERE EXISTS (SELECT 1 FROM resources WHERE id = 7 AND file_key = 'resources/1771559779977-Sequence_and_Series.pdf');
INSERT INTO resource_folders (parent_id, name, kind, access, creator_id)
SELECT (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 2U (HSC)' AND s.kind = 'section' AND s.name = 'Trial'), 'Math A Class Notes', 'folder', 'everyone', (SELECT id FROM users WHERE id = 3)
WHERE EXISTS (SELECT 1 FROM resources WHERE id = 50 AND file_key = 'resources/1784354636670-Third_copy.pdf');

-- Notes. subject is kept in step with the folder chain's root.
-- 23: Biology Notes
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Biology' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Biology' WHERE id = 23 AND file_key = 'resources/1772490342938-Year_11.pdf';
-- 39: Bio Papers On Canvas
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Biology' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Biology' WHERE id = 39 AND file_key = 'resources/1778283084442-Bio_Past_Papers.zip';
-- 54: Year 10 Biology Notes
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Biology' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Biology' WHERE id = 54 AND file_key = 'resources/1786099936796-Y10bio.pdf';
-- 30: Biology T1 Flashcards
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Anki Flashcards' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Biology' AND s.kind = 'section' AND s.name = 'Unfiled')), subject = 'Biology' WHERE id = 30 AND file_key = 'resources/1776061446051-Biology_T1.apkg';
-- 38: Mod 2 Bio Flashcards (Up to T2 Wk 3)
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Anki Flashcards' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Biology' AND s.kind = 'section' AND s.name = 'Unfiled')), subject = 'Biology' WHERE id = 38 AND file_key = 'resources/1778151928757-Biology__Mod_2_Organisation_of_living_things.apkg';
-- 65: Mod 2 Bio Flashcards for Term 3
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Anki Flashcards' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Biology' AND s.kind = 'section' AND s.name = 'Unfiled')), subject = 'Biology' WHERE id = 65 AND file_key = 'resources/1789358461108-Biology__Mod_2_Organisation_of_living_things__T3_.apkg';
-- 66: Mod 3 Bio Flashcards
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Anki Flashcards' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Biology' AND s.kind = 'section' AND s.name = 'Unfiled')), subject = 'Biology' WHERE id = 66 AND file_key = 'resources/1789358519879-Biology__Mod_3_Biological_diversity.apkg';
-- 67: Mod 4 Bio Flashcards
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Anki Flashcards' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Biology' AND s.kind = 'section' AND s.name = 'Unfiled')), subject = 'Biology' WHERE id = 67 AND file_key = 'resources/1789358541202-Biology__Mod_4_Ecosystem_Dynamics.apkg';
-- 76: Bio Task 1 Flashcards (v1)
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Biology (HSC)' AND s.kind = 'section' AND s.name = 'Task 1'), subject = 'Biology (HSC)' WHERE id = 76 AND file_key = 'resources/1794132339031-Biology_HSC.apkg';
-- 2: Anki Flashcards - Role of Business
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Business Studies' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Business Studies' WHERE id = 2 AND file_key = 'resources/1770109964679-Anki_-_Role_Of_Business.apkg';
-- 11: Nature of Business Notes — Preliminary
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Business Studies' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Business Studies' WHERE id = 11 AND file_key = 'resources/1771846487090-Topic_1_Combined.pdf';
-- 12: Business Planning Notes — Preliminary
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Business Studies' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Business Studies' WHERE id = 12 AND file_key = 'resources/1771846587225-Topic_3_Combined_unlocked.pdf';
-- 13: Business Management Notes — Preliminary
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Business Studies' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Business Studies' WHERE id = 13 AND file_key = 'resources/1771846693097-Topic_2_Combined.pdf';
-- 62: ALL topics notes Business Studies
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Business Studies (HSC)' AND s.kind = 'section' AND s.name = 'HSC'), subject = 'Business Studies (HSC)' WHERE id = 62 AND file_key = 'resources/1788512238438-__Business_Studies.zip';
-- 3: Anki Flashcards - Role of Marketing
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Business Studies (HSC)' AND s.kind = 'section' AND s.name = 'Task 1'), subject = 'Business Studies (HSC)' WHERE id = 3 AND file_key = 'resources/1770111700278-Anki_-_Role_of_Marketing.apkg';
-- 8: HSC task 1 49/50 - 19/20 Report
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Business Studies (HSC)' AND s.kind = 'section' AND s.name = 'Task 1'), subject = 'Business Studies (HSC)' WHERE id = 8 AND file_key = 'resources/1771572125288-ricky_49_50_hsc_1.pdf';
-- 16: Marketing Role Notes
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Marketing Notes' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Business Studies (HSC)' AND s.kind = 'section' AND s.name = 'Task 1')), subject = 'Business Studies (HSC)' WHERE id = 16 AND file_key = 'resources/1771914727922-Marketing_Role.md';
-- 17: Marketing Influences Notes
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Marketing Notes' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Business Studies (HSC)' AND s.kind = 'section' AND s.name = 'Task 1')), subject = 'Business Studies (HSC)' WHERE id = 17 AND file_key = 'resources/1771914742099-Marketing_Influences.md';
-- 18: Marketing Processes Notes
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Marketing Notes' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Business Studies (HSC)' AND s.kind = 'section' AND s.name = 'Task 1')), subject = 'Business Studies (HSC)' WHERE id = 18 AND file_key = 'resources/1771914754532-Marketing_Processes.md';
-- 19: Marketing Strategies Notes
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Marketing Notes' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Business Studies (HSC)' AND s.kind = 'section' AND s.name = 'Task 1')), subject = 'Business Studies (HSC)' WHERE id = 19 AND file_key = 'resources/1771914767503-Marketing_Strategies.md';
-- 57: HSC Task 3 Finance - 48/50, 18/20 Report
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Business Studies (HSC)' AND s.kind = 'section' AND s.name = 'Task 3'), subject = 'Business Studies (HSC)' WHERE id = 57 AND file_key = 'resources/1787367237576-task_3_ricky_compressed.pdf';
-- 63: Trials 94/100
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Business Studies (HSC)' AND s.kind = 'section' AND s.name = 'Trial'), subject = 'Business Studies (HSC)' WHERE id = 63 AND file_key = 'resources/1788762097089-compressed.pdf';
-- 26: Mod 1 Notes
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Chemistry' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Chemistry' WHERE id = 26 AND file_key = 'resources/1773709790801-Module_1_Summary.pdf';
-- 31: Chem T1 Flashcards
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Chemistry' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Chemistry' WHERE id = 31 AND file_key = 'resources/1776061526838-Chemistry.apkg';
-- 40: Chem Papers on Canvas
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Chemistry' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Chemistry' WHERE id = 40 AND file_key = 'resources/1778283125722-Chem_Past_Papers.zip';
-- 47: Flashcards for Ch9 Gas Laws (Last section of Mod 2)
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Chemistry' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Chemistry' WHERE id = 47 AND file_key = 'resources/1780143209359-Chemistry__Ch9_Gas_Laws.apkg';
-- 59: Chemistry Module 1 Notes
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Chemistry' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Chemistry' WHERE id = 59 AND file_key = 'resources/1787983531251-CHE_Module_1_Notes.pdf';
-- 27: HSC Chemistry Notes (Mod 5-8)
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Chemistry (HSC)' AND s.kind = 'section' AND s.name = 'HSC'), subject = 'Chemistry (HSC)' WHERE id = 27 AND file_key = 'resources/1773887468369-Baulko_HSC_Chem_Notes.pdf';
-- 41: Econ Papers on Canvas
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Economics' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Economics' WHERE id = 41 AND file_key = 'resources/1778283180831-Econ_Past_Papers.zip';
-- 4: Chapter 1: Intro to Economics/The Economic Problem flashcards
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Anki Flashcards' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Economics' AND s.kind = 'section' AND s.name = 'Unfiled')), subject = 'Economics' WHERE id = 4 AND file_key = 'resources/1771039928150-Economics__Ch_1_The_economic_problem.apkg';
-- 6: Ch 2 Operation of an Economy flashcards
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Anki Flashcards' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Economics' AND s.kind = 'section' AND s.name = 'Unfiled')), subject = 'Economics' WHERE id = 6 AND file_key = 'resources/1771491026874-Economics__Ch_2_The_operation_of_an_economy.apkg';
-- 32: Ch 3 The Similarities & Differences of Economies flashcards
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Anki Flashcards' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Economics' AND s.kind = 'section' AND s.name = 'Unfiled')), subject = 'Economics' WHERE id = 32 AND file_key = 'resources/1776061661447-Economics__Ch_3_The_similaries___differences_of_economies.apkg';
-- 33: Ch 4 Consumers in the Economy flashcards
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Anki Flashcards' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Economics' AND s.kind = 'section' AND s.name = 'Unfiled')), subject = 'Economics' WHERE id = 33 AND file_key = 'resources/1776061766466-Economics__Ch_4_Consumers_in_the_Economy.apkg';
-- 34: Ch 5 Businesses in the Economy flashcards
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Anki Flashcards' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Economics' AND s.kind = 'section' AND s.name = 'Unfiled')), subject = 'Economics' WHERE id = 34 AND file_key = 'resources/1776061808984-Economics__Ch_5_Businesses_in_the_Economy.apkg';
-- 35: Ch 6 Demand and Supply flashcards (T1 only)
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Anki Flashcards' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Economics' AND s.kind = 'section' AND s.name = 'Unfiled')), subject = 'Economics' WHERE id = 35 AND file_key = 'resources/1776061854981-Economics__Ch_6_Demand_and_supply.apkg';
-- 36: Ch 6 Demand and Supply flashcards (updated for HY)
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Anki Flashcards' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Economics' AND s.kind = 'section' AND s.name = 'Unfiled')), subject = 'Economics' WHERE id = 36 AND file_key = 'resources/1777448142468-Economics__Ch_6_Demand_and_supply_UPDATED.apkg';
-- 37: Ch 7 Market Equilibrium & Government Intervention Flashcards
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Anki Flashcards' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Economics' AND s.kind = 'section' AND s.name = 'Unfiled')), subject = 'Economics' WHERE id = 37 AND file_key = 'resources/1778069832879-Economics__Ch_7_Market_equilibrium___government_intervention.apkg';
-- 77: Eco Task 1 Flashcards (v1)
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Economics (HSC)' AND s.kind = 'section' AND s.name = 'Task 1'), subject = 'Economics (HSC)' WHERE id = 77 AND file_key = 'resources/1794132393406-Economics_HSC.apkg';
-- 64: YEARLY Short Answer Practice
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'English Advanced' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'English Advanced' WHERE id = 64 AND file_key = 'resources/1789273861380-Archive.zip';
-- 73: Question 7 pdf
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'English Advanced (HSC)' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'English Advanced (HSC)' WHERE id = 73 AND file_key = 'resources/1793011765377-richard-flanagan-question-7-retail.pdf';
-- 21: Human-Environment Interactions Extended Responses
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Geography' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Geography' WHERE id = 21 AND file_key = 'resources/1772078151056-Human-Environment_Interactions_Extended_Responses.pdf';
-- 22: Preliminary Revision notes
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Geography' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Geography' WHERE id = 22 AND file_key = 'resources/1772078230560-Revision_Geo___4_.pdf';
-- 72: somewhat more difficult mock hsc 2u paper
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 2U (HSC)' AND s.kind = 'section' AND s.name = 'HSC'), subject = 'Mathematics 2U (HSC)' WHERE id = 72 AND file_key = 'resources/1792118080115-nswmaths_2U_2025.pdf';
-- 9: Final Value and present value
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 2U (HSC)' AND s.kind = 'section' AND s.name = 'Task 1'), subject = 'Mathematics 2U (HSC)' WHERE id = 9 AND file_key = 'resources/1771817888462-Fv_Pv.pdf';
-- 42: Year 11 Mathematics Half Yearly Past Papers (w/o Solutions)
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 2U (HSC)' AND s.kind = 'section' AND s.name = 'Task 1'), subject = 'Mathematics 2U (HSC)' WHERE id = 42 AND file_key = 'resources/1778309915155-SBHS_2025_Y11_MA_Acc_Task_1.pdf';
-- 45: more maths canvas papers (only canvas, check Past Papers for other) 
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 2U (HSC)' AND s.kind = 'section' AND s.name = 'Task 1'), subject = 'Mathematics 2U (HSC)' WHERE id = 45 AND file_key = 'resources/1778404513801-drive-download-20260510T091421Z-3-001.zip';
-- 7: Math A in-class work: Sequence and Series
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Math A Class Notes' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 2U (HSC)' AND s.kind = 'section' AND s.name = 'Task 1')), subject = 'Mathematics 2U (HSC)' WHERE id = 7 AND file_key = 'resources/1771559779977-Sequence_and_Series.pdf';
-- 24: Math A in-class work: Trig and Year 10 Review including Factors, Simultaneous Equations, R
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Math A Class Notes' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 2U (HSC)' AND s.kind = 'section' AND s.name = 'Task 1')), subject = 'Mathematics 2U (HSC)' WHERE id = 24 AND file_key = 'resources/1772667363182-Math_2.pdf';
-- 28: Math A in-class: Functions including notation, domain & range, composition, even & odd, sk
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Math A Class Notes' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 2U (HSC)' AND s.kind = 'section' AND s.name = 'Task 1')), subject = 'Mathematics 2U (HSC)' WHERE id = 28 AND file_key = 'resources/1775272970122-Math_3_copy.pdf';
-- 29: Math A in-class: quadratic identity, sum & products of roots, discriminant, polynomials, l
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Math A Class Notes' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 2U (HSC)' AND s.kind = 'section' AND s.name = 'Task 1')), subject = 'Mathematics 2U (HSC)' WHERE id = 29 AND file_key = 'resources/1775273106375-Math_3.pdf';
-- 46: Math A in-class: extended logarithm, graphical trigonometry solution, calculus 
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Math A Class Notes' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 2U (HSC)' AND s.kind = 'section' AND s.name = 'Task 1')), subject = 'Mathematics 2U (HSC)' WHERE id = 46 AND file_key = 'resources/1778836024952-Term_2.pdf';
-- 55: 2u Exam of Doom and Despair
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 2U (HSC)' AND s.kind = 'section' AND s.name = 'Trial'), subject = 'Mathematics 2U (HSC)' WHERE id = 55 AND file_key = 'resources/1786606962998-2u_Exam_Of_Doom_And_Despair.pdf';
-- 56: 2026 Y11 2U SBHS THSC STUDENT WORKED SOLUTIONS
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 2U (HSC)' AND s.kind = 'section' AND s.name = 'Trial'), subject = 'Mathematics 2U (HSC)' WHERE id = 56 AND file_key = 'resources/1787315261869-2026_Y11_2U_SBHS_THSC_STUDENT_WORKED_SOLUTIONS.pdf';
-- 60: Math 2U 2026 THSC Solution
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 2U (HSC)' AND s.kind = 'section' AND s.name = 'Trial'), subject = 'Mathematics 2U (HSC)' WHERE id = 60 AND file_key = 'resources/1788246331392-SBHS_MA_THSC_2026__SOL.pdf';
-- 50: Math A in-class notes: Probability
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Math A Class Notes' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 2U (HSC)' AND s.kind = 'section' AND s.name = 'Trial')), subject = 'Mathematics 2U (HSC)' WHERE id = 50 AND file_key = 'resources/1784354636670-Third_copy.pdf';
-- 51: Math A in class notes: Differential Calculus
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Math A Class Notes' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 2U (HSC)' AND s.kind = 'section' AND s.name = 'Trial')), subject = 'Mathematics 2U (HSC)' WHERE id = 51 AND file_key = 'resources/1784354728883-Third_copy_2.pdf';
-- 52: Math A in-class: Integral Calculus 1 
UPDATE resources SET folder_id = (SELECT f.id FROM resource_folders f WHERE f.kind = 'folder' AND f.name = 'Math A Class Notes' AND f.parent_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 2U (HSC)' AND s.kind = 'section' AND s.name = 'Trial')), subject = 'Mathematics 2U (HSC)' WHERE id = 52 AND file_key = 'resources/1784355147576-Integration_3_copy.pdf';
-- 78: Mock 3u task 1
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 3U (HSC)' AND s.kind = 'section' AND s.name = 'Task 1'), subject = 'Mathematics 3U (HSC)' WHERE id = 78 AND file_key = 'resources/1794194111539-PDF_2.pdf';
-- 14: The Basics of Writing an Induction Proof (support file not provided - please refer to the 
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 3U (HSC)' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Mathematics 3U (HSC)' WHERE id = 14 AND file_key = 'resources/1771881876001-economy-composition-snapshot.pdf';
-- 25: Notes on Vectors 
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 3U (HSC)' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Mathematics 3U (HSC)' WHERE id = 25 AND file_key = 'resources/1772667502293-Vectors.pdf';
-- 75: Mock 4u task 1
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 4U (HSC)' AND s.kind = 'section' AND s.name = 'Task 1'), subject = 'Mathematics 4U (HSC)' WHERE id = 75 AND file_key = 'resources/1793836405284-batcha_4u_2026_sb_mock_at1.pdf';
-- 15: Different Types of Histories
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Modern History' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Modern History' WHERE id = 15 AND file_key = 'resources/1771895224714-Different_Types_of_Histories.pdf';
-- 43: Physics Module 1 Dynamics Note (all)
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Physics' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Physics' WHERE id = 43 AND file_key = 'resources/1778403994057-Notes.pdf';
-- 44: (only canvas ones, check Past Papers tab for others) physics past paper because canvas is 
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Physics' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Physics' WHERE id = 44 AND file_key = 'resources/1778404401287-canvas_physics_paper.zip';
-- 53: Physics 2024 Y11 Depth Study
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Physics' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Physics' WHERE id = 53 AND file_key = 'resources/1785749422901-2024_Y11_DS_Exam_Marking_Scheme_NEW.docx';
-- 61: Wave Properties on a fundamental level 
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Physics' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Physics' WHERE id = 61 AND file_key = 'resources/1788304263303-Waves_properties_1.pdf';
-- 68: Yearly Past Papers 
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Physics' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Physics' WHERE id = 68 AND file_key = 'resources/1789374059022-theory_e_ams_export-2.zip';
-- 5: Circuit Symbols Anki Cards
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Software Engineering' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Software Engineering' WHERE id = 5 AND file_key = 'resources/1771122847847-Circuit_Symbols.apkg';
-- 69: SOR II Religion Tradition Study Notes - Buddhism
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Studies of Religion II (HSC)' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Studies of Religion II (HSC)' WHERE id = 69 AND file_key = 'resources/1789821714794-2d2d876d-b32c-4a2e-9e21-42f1a95703ee_Religious_Tradition_Study_2_-_Buddhism.pdf';
-- 70: SOR II Religion Tradition Study Notes - Christianity
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Studies of Religion II (HSC)' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Studies of Religion II (HSC)' WHERE id = 70 AND file_key = 'resources/1789821898757-9d0a55ae-8f73-4d4f-b862-98aad2356af7_Religious_Tradition_Study_1_-_Christianity.pdf';
-- 71: SOR II Religion Tradition Study Notes - Islam
UPDATE resources SET folder_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Studies of Religion II (HSC)' AND s.kind = 'section' AND s.name = 'Unfiled'), subject = 'Studies of Religion II (HSC)' WHERE id = 71 AND file_key = 'resources/1789822060769-a5050719-b66b-4fbe-9bee-fa9c43359eec_Religious_Tradition_Study_3_-_Islam.pdf';

-- 'Mathematics 3U' and 'Mathematics Advanced' are not in src/constants.ts; 029 only created them
-- because old notes used them. Point the one removed note at 2U's Unfiled, then drop them if empty.
UPDATE resources SET subject = 'Mathematics 2U (HSC)', removed_from_id = (SELECT s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id WHERE p.kind = 'subject' AND p.subject = 'Mathematics 2U (HSC)' AND s.kind = 'section' AND s.name = 'Unfiled') WHERE id = 1 AND file_key = 'resources/1767140553468-ilide.info-adv-ex-08-application-of-differentiation-pr_95c35e6243ddc40333fe628a97837b98.pdf' AND folder_id = (SELECT id FROM resource_folders WHERE kind = 'trash');
DELETE FROM resource_folders WHERE kind = 'section' AND parent_id IN (SELECT id FROM resource_folders WHERE kind = 'subject' AND subject IN ('Mathematics 3U', 'Mathematics Advanced')) AND NOT EXISTS (SELECT 1 FROM resources r WHERE r.folder_id = resource_folders.id OR r.removed_from_id = resource_folders.id) AND NOT EXISTS (SELECT 1 FROM resource_folders c WHERE c.parent_id = resource_folders.id OR c.removed_from_id = resource_folders.id);
DELETE FROM resource_folders WHERE kind = 'subject' AND subject IN ('Mathematics 3U', 'Mathematics Advanced') AND NOT EXISTS (SELECT 1 FROM resources r WHERE r.folder_id = resource_folders.id OR r.removed_from_id = resource_folders.id) AND NOT EXISTS (SELECT 1 FROM resource_folders c WHERE c.parent_id = resource_folders.id OR c.removed_from_id = resource_folders.id);
