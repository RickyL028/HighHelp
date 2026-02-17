PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT UNIQUE NOT NULL, -- 9 digits
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT, -- hashed password (plain text for initial prototype if needed, but should be hashed)
  role TEXT DEFAULT 'student',
  permission_level INTEGER DEFAULT 0,
  tags TEXT, -- JSON string or comma-separated list
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
, points REAL DEFAULT 0);
INSERT INTO "users" VALUES(1,'100000000','Ricky','Ricky','notricky028@gmail.com','password123','student',99,'{"C*":1}','2025-12-26 02:18:53',0);
INSERT INTO "users" VALUES(2,'200000000','Old','Major','oldmajor@animal.farm','oldmajor','tester',2,'{"C*":1, "Math":1}','2025-12-30 02:08:46',0);
INSERT INTO "users" VALUES(3,'457297106','Ricky','Luo','457297106@student.sbhs.nsw.edu.au',NULL,'student',4,'{"C*":1}','2025-12-30 06:05:53',3);
INSERT INTO "users" VALUES(4,'444644630','Lucas','Chen','444644630@student.sbhs.nsw.edu.au',NULL,'student',5,'{"C*":1}','2025-12-30 06:21:44',0);
INSERT INTO "users" VALUES(5,'457296991','Nicklas','Li','457296991@student.sbhs.nsw.edu.au',NULL,'student',2,'{"C*":1}','2025-12-30 06:35:09',3);
INSERT INTO "users" VALUES(6,'446231570','Terry','Zhang','446231570@student.sbhs.nsw.edu.au',NULL,'student',0,'{"C*":1}','2025-12-30 07:35:52',0);
INSERT INTO "users" VALUES(7,'446110152','Nireat','Deka','446110152@student.sbhs.nsw.edu.au',NULL,'student',0,'{"C*":1}','2026-01-01 11:28:49',0);
INSERT INTO "users" VALUES(8,'446013688','Caspar','Lai','446013688@student.sbhs.nsw.edu.au',NULL,'student',2,'{"C*":1}','2026-01-03 05:05:50',1.3);
INSERT INTO "users" VALUES(9,'446983067','Franklin','Huang','446983067@student.sbhs.nsw.edu.au',NULL,'student',2,'{"C*":1}','2026-01-05 10:12:11',0.3);
INSERT INTO "users" VALUES(10,'449240901','Aryaman','Pachori','449240901@student.sbhs.nsw.edu.au','1','student',2,'{"C*":1}','2026-01-13 23:19:40',0);
INSERT INTO "users" VALUES(11,'449392752','Munjin','Chowdhury','449392752@student.sbhs.nsw.edu.au',NULL,'student',2,'{"C*":1}','2026-01-14 01:38:22',0);
INSERT INTO "users" VALUES(12,'445730793','Joshua','Kuo','445730793@student.sbhs.nsw.edu.au',NULL,'student',2,'{"C*":1}','2026-01-14 08:17:13',0);
INSERT INTO "users" VALUES(13,'446324551','Anay','Gautam','446324551@student.sbhs.nsw.edu.au',NULL,'student',1,'{"C*":1}','2026-01-15 03:05:56',0);
INSERT INTO "users" VALUES(14,'444605880','Kyle','Lee','444605880@student.sbhs.nsw.edu.au','1','student',2,'{"C*":1}','2026-01-15 03:31:00',0);
INSERT INTO "users" VALUES(15,'445228125','Aiden','Ton-That','445228125@student.sbhs.nsw.edu.au',NULL,'student',0,'{"C*":1}','2026-01-15 11:45:00',-1.4000000000000004);
INSERT INTO "users" VALUES(16,'445984833','Theodore','Hui','445984833@student.sbhs.nsw.edu.au',NULL,'student',1,'{}','2026-01-16 02:53:12',0);
INSERT INTO "users" VALUES(17,'445768545','Geoffrey','Li','445768545@student.sbhs.nsw.edu.au',NULL,'student',3,'{"C*":1,"Math":1}','2026-01-19 02:44:23',1);
INSERT INTO "users" VALUES(18,'446060171','Om','Dave','446060171@student.sbhs.nsw.edu.au',NULL,'student',0,NULL,'2026-01-21 05:19:54',0);
INSERT INTO "users" VALUES(19,'446059360','Ryan','Mather','446059360@student.sbhs.nsw.edu.au',NULL,'student',0,NULL,'2026-01-29 23:16:38',0);
INSERT INTO "users" VALUES(20,'445947687','Dennis','Chen','445947687@student.sbhs.nsw.edu.au',NULL,'student',2,'{"C*":1}','2026-02-03 08:56:28',6.3);
INSERT INTO "users" VALUES(21,'446146581','Jasper','Kim','446146581@student.sbhs.nsw.edu.au',NULL,'student',2,'{"C*":1}','2026-02-03 08:57:41',0);
INSERT INTO "users" VALUES(22,'451790757','Tuyvan','Mai','451790757@student.sbhs.nsw.edu.au',NULL,'student',1,NULL,'2026-02-03 09:49:35',0);
INSERT INTO "users" VALUES(23,'446025082','Adam Ly','Nguyen','446025082@student.sbhs.nsw.edu.au',NULL,'student',0,NULL,'2026-02-07 03:53:30',0);
INSERT INTO "users" VALUES(24,'451801945','Jun','Shim','451801945@student.sbhs.nsw.edu.au',NULL,'student',5,NULL,'2026-02-07 05:42:32',0);
INSERT INTO "users" VALUES(25,'446120875','Oscar','Luo','446120875@student.sbhs.nsw.edu.au',NULL,'student',0,NULL,'2026-02-08 21:30:01',0);
INSERT INTO "users" VALUES(26,'446310941','Wesley','Hamilton','446310941@student.sbhs.nsw.edu.au',NULL,'student',0,NULL,'2026-02-08 21:33:22',0);
INSERT INTO "users" VALUES(27,'446156501','Alexander','Liu','446156501@student.sbhs.nsw.edu.au',NULL,'student',1,NULL,'2026-02-09 21:41:41',0.3);
INSERT INTO "users" VALUES(28,'446289471','Andrew','Wu','446289471@student.sbhs.nsw.edu.au',NULL,'student',0,NULL,'2026-02-09 23:00:24',0);
INSERT INTO "users" VALUES(29,'445663085','Roger','He','445663085@student.sbhs.nsw.edu.au',NULL,'student',0,NULL,'2026-02-10 23:32:43',0);
INSERT INTO "users" VALUES(30,'451974076','Sharvil','Pande','451974076@student.sbhs.nsw.edu.au',NULL,'student',0,NULL,'2026-02-12 01:14:26',0);
INSERT INTO "users" VALUES(31,'445927384','Felix','Tran','445927384@student.sbhs.nsw.edu.au',NULL,'student',0,NULL,'2026-02-12 01:49:32',0);
INSERT INTO "users" VALUES(32,'444881402','Hriman','Joshi','444881402@student.sbhs.nsw.edu.au',NULL,'student',0,NULL,'2026-02-12 02:47:01',0);
INSERT INTO "users" VALUES(33,'451883682','Aryan','Ghosh','451883682@student.sbhs.nsw.edu.au',NULL,'student',0,NULL,'2026-02-12 02:49:15',0);
INSERT INTO "users" VALUES(34,'446133021','Kevin','Hu','446133021@student.sbhs.nsw.edu.au',NULL,'student',0,NULL,'2026-02-12 09:05:12',0);
INSERT INTO "users" VALUES(35,'447099837','Tilak','Patel','447099837@student.sbhs.nsw.edu.au',NULL,'student',1,NULL,'2026-02-12 22:05:10',0);
CREATE TABLE resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  file_key TEXT NOT NULL, -- R2 object key
  subject TEXT NOT NULL,
  type TEXT DEFAULT 'resource', -- 'resource' or 'past_paper'
  uploader_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, is_deleted BOOLEAN DEFAULT 0, download_count INTEGER DEFAULT 0,
  FOREIGN KEY (uploader_id) REFERENCES users(id)
);
INSERT INTO "resources" VALUES(1,'Differentiation Practice','HK DSE','resources/1767140553468-ilide.info-adv-ex-08-application-of-differentiation-pr_95c35e6243ddc40333fe628a97837b98.pdf','Mathematics Advanced','resource',2,'2025-12-31 00:22:34',0,0);
INSERT INTO "resources" VALUES(2,'Anki Flashcards - Role of Business','All content on the role and function of businesses.','resources/1770109964679-Anki_-_Role_Of_Business.apkg','Business Studies','resource',20,'2026-02-03 09:12:44',0,0);
INSERT INTO "resources" VALUES(3,'Anki Flashcards - Role of Marketing','Have Anki downloaded before downloading the file. ','resources/1770111700278-Anki_-_Role_of_Marketing.apkg','Business Studies (HSC)','resource',20,'2026-02-03 09:41:40',0,0);
INSERT INTO "resources" VALUES(4,'Chapter 1: Intro to Economics/The Economic Problem flashcards',replace(replace('It needs anki to work\r\nhttps://apps.ankiweb.net/ to install anki','\r',char(13)),'\n',char(10)),'resources/1771039928150-Economics__Ch_1_The_economic_problem.apkg','Economics','resource',5,'2026-02-14 03:32:08',0,0);
INSERT INTO "resources" VALUES(5,'Circuit Symbols Anki Cards','HSC curriculum','resources/1771122847847-Circuit_Symbols.apkg','Software Engineering','resource',3,'2026-02-15 02:34:08',0,0);
CREATE TABLE announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  subject TEXT DEFAULT 'General',
  priority TEXT DEFAULT 'normal', -- normal, high, urgent
  author_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, is_deleted BOOLEAN DEFAULT 0,
  FOREIGN KEY (author_id) REFERENCES users(id)
);
INSERT INTO "announcements" VALUES(5,'test announcement','when does munjin find out this is real','Mathematics 3U','normal',17,'2026-01-21 04:39:33',1);
INSERT INTO "announcements" VALUES(6,'ban list when','get zi and austin outta here','Mathematics 3U','normal',17,'2026-02-09 21:40:05',1);
INSERT INTO "announcements" VALUES(7,'HighHelp v.0.0.1 Release',replace(replace('HighHelp v0.0.1 released! Including a new domain name highhelp.org, and major timetable fixes.\r\n\r\nFuture updates may include integration of Canvas api.','\r',char(13)),'\n',char(10)),'Other','normal',3,'2026-02-12 08:11:39',0);
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL, -- 'qa' or 'essay'
  author_id INTEGER,
  subject TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, is_deleted BOOLEAN DEFAULT 0,
  FOREIGN KEY (author_id) REFERENCES users(id)
);
INSERT INTO "posts" VALUES(1,'whats 1+1','??? help','question',2,'Mathematics Advanced','2026-01-02 04:58:07',1);
INSERT INTO "posts" VALUES(2,'你认为柏拉图的“洞穴寓言”想表达什么思想？它对人类认识真理有什么启示？','《洞穴寓言》是柏拉图在《理想国》中提出的一个著名隐喻，用来阐述他关于知识、无知与启蒙的思想。在这个寓言中，囚犯被锁链束缚在洞穴里，把墙上的影子误认为是真实的世界。当其中一名囚犯逃离洞穴并看到外面的世界时，他意识到自己过去所相信的一切都是虚假的。这个问题要求学生解读这一寓言，并解释柏拉图想通过它表达的关于教育、认知以及人类在接受更深层真理时所面临的困难。','question',8,'Chinese Continuers','2026-01-03 05:13:01',0);
INSERT INTO "posts" VALUES(3,'We need to use IQTVE for year 11 and year 12','The NSG cohort for 2025 specifically said they increased from rank 13 in english to rank 2 in english (after NSB) is BECAUSE of their employment of IQTVE in english essays as well as short answer responses. I am going to email Mr Caputo and ask him to implement IQTVE into our curriculum in order to maximise our weakest yet most important subject: ENGLISH ','question',9,'English Advanced','2026-01-05 10:21:52',0);
INSERT INTO "posts" VALUES(4,'only for prestudy gods',replace(replace('Preliminary Advanced Unit\r\n\r\nTerm 1: Reading to Write; no set texts... look at a range of texts to guide your own writing\r\n\r\nTerm 2: Narratives that Shape Our World; Shelley''s novel ''Frankenstein'' and Kaluuya''s film ''Get Out'' (narratives of the monster or monstrosity)\r\n\r\nTerm 3: Close Study of Text (Shakespeare - either ''King Lear'' or ''Antony and Cleopatra'')\r\n\r\n \r\n\r\nPreliminary Extension Unit\r\n\r\nThis is a single unit over three terms, titled Responses to Colonialism\r\n\r\nTerm 1: Conrad''s novel ''Heart of Darkness''\r\n\r\nTerm 2: Coppola''s film ''Apocalypse Now''\r\n\r\nTerm 3: van Neerven''s poetry collection ''Throat''','\r',char(13)),'\n',char(10)),'question',15,'English Advanced','2026-01-15 12:21:05',1);
INSERT INTO "posts" VALUES(5,'When are yearlys for y11','e','question',16,'All','2026-01-16 02:58:36',0);
INSERT INTO "posts" VALUES(6,'when are math classes releasing',replace(replace('speed i need this\r\nmunjin''s kinda begging me','\r',char(13)),'\n',char(10)),'question',17,'Mathematics 3U','2026-01-21 04:41:06',1);
INSERT INTO "posts" VALUES(7,'can you can a can faster than a canner can can a can','cans','question',25,'All','2026-02-08 21:31:25',0);
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER,
  content TEXT NOT NULL,
  author_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, is_deleted BOOLEAN DEFAULT 0,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
);
INSERT INTO "comments" VALUES(1,1,'dunno',2,'2026-01-02 05:23:18',0);
INSERT INTO "comments" VALUES(2,1,'5',8,'2026-01-03 05:10:27',0);
INSERT INTO "comments" VALUES(3,3,'https://www.smh.com.au/national/nsw/the-five-letter-formula-that-saw-this-school-s-hsc-english-marks-soar-20251215-p5nnwl.html',9,'2026-01-05 10:22:26',0);
INSERT INTO "comments" VALUES(4,3,'rigged hsc rankings',15,'2026-01-15 12:28:37',1);
INSERT INTO "comments" VALUES(5,2,'你好',15,'2026-01-15 12:29:30',1);
INSERT INTO "comments" VALUES(6,2,'你好',15,'2026-01-15 12:29:34',1);
INSERT INTO "comments" VALUES(7,2,'你好',15,'2026-01-15 12:29:38',1);
INSERT INTO "comments" VALUES(8,2,'你好',15,'2026-01-15 12:29:42',1);
INSERT INTO "comments" VALUES(9,2,'你好',15,'2026-01-15 12:29:46',1);
INSERT INTO "comments" VALUES(10,2,'你好',15,'2026-01-15 12:29:50',1);
INSERT INTO "comments" VALUES(11,2,'你好',15,'2026-01-15 12:29:54',1);
INSERT INTO "comments" VALUES(12,2,'你好',15,'2026-01-15 12:29:59',1);
INSERT INTO "comments" VALUES(13,2,'你好',15,'2026-01-15 12:30:04',1);
INSERT INTO "comments" VALUES(14,2,'你好',15,'2026-01-15 12:30:09',1);
INSERT INTO "comments" VALUES(15,2,'你好',15,'2026-01-15 12:30:14',1);
INSERT INTO "comments" VALUES(16,5,'Term 3 Weeks 9-10 ie. September 14-25.',20,'2026-02-03 09:19:57',0);
INSERT INTO "comments" VALUES(17,7,replace(replace('no\r\n','\r',char(13)),'\n',char(10)),27,'2026-02-12 03:03:20',0);
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" VALUES(1,'001_add_past_paper_bank.sql','2025-12-30 01:59:29');
INSERT INTO "d1_migrations" VALUES(2,'002_add_paper_tag.sql','2025-12-30 01:59:29');
INSERT INTO "d1_migrations" VALUES(3,'003_initial_schema.sql','2026-01-03 04:04:59');
INSERT INTO "d1_migrations" VALUES(4,'004_add_points_and_essays.sql','2026-01-03 04:05:00');
INSERT INTO "d1_migrations" VALUES(5,'005_enhance_essays.sql','2026-01-03 04:05:01');
INSERT INTO "d1_migrations" VALUES(6,'003_permission_system.sql','2026-01-05 10:01:38');
INSERT INTO "d1_migrations" VALUES(7,'006_add_is_deleted_to_essays.sql','2026-01-05 10:01:39');
INSERT INTO "d1_migrations" VALUES(8,'007_remake_past_papers.sql','2026-01-14 07:14:42');
INSERT INTO "d1_migrations" VALUES(9,'008_add_ordering_index.sql','2026-01-14 07:14:43');
INSERT INTO "d1_migrations" VALUES(10,'009_add_user_question_attempts.sql','2026-01-14 07:14:43');
INSERT INTO "d1_migrations" VALUES(11,'010_add_paper_type_locked.sql','2026-01-14 07:14:44');
INSERT INTO "d1_migrations" VALUES(12,'011_add_mock_exams.sql','2026-01-15 02:49:32');
INSERT INTO "d1_migrations" VALUES(13,'012_isolate_mock_attempts.sql','2026-01-16 03:57:03');
INSERT INTO "d1_migrations" VALUES(14,'013_add_review_attempts.sql','2026-01-16 03:57:03');
INSERT INTO "d1_migrations" VALUES(15,'014_add_text_content.sql','2026-01-17 23:40:11');
INSERT INTO "d1_migrations" VALUES(16,'015_add_download_count.sql','2026-01-27 01:17:20');
CREATE TABLE topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(subject, name)
);
INSERT INTO "topics" VALUES(1,'Mathematics Advanced X1','Matrices','2026-01-02 05:01:32');
INSERT INTO "topics" VALUES(2,'Mathematics 3U','Algebra','2026-01-14 07:55:57');
INSERT INTO "topics" VALUES(4,'Mathematics 3U','Trigonometry','2026-01-14 07:56:32');
INSERT INTO "topics" VALUES(5,'Mathematics 3U','Functions','2026-01-14 07:56:41');
INSERT INTO "topics" VALUES(6,'Mathematics 3U','Graphs','2026-01-14 07:56:51');
INSERT INTO "topics" VALUES(7,'Mathematics 3U','Differentiation ','2026-01-14 07:57:00');
INSERT INTO "topics" VALUES(8,'Mathematics 3U','Polynomials','2026-01-14 07:57:06');
INSERT INTO "topics" VALUES(9,'Mathematics 3U','Probability','2026-01-14 07:57:19');
INSERT INTO "topics" VALUES(10,'Mathematics 3U','Combinatorics','2026-01-14 07:57:29');
INSERT INTO "topics" VALUES(11,'Mathematics 3U','Geometry','2026-01-16 05:20:00');
INSERT INTO "topics" VALUES(12,'Mathematics 3U','Inequalities','2026-01-16 05:28:18');
INSERT INTO "topics" VALUES(13,'Mathematics 3U','Logarithm','2026-01-16 05:35:32');
INSERT INTO "topics" VALUES(14,'Business Studies (HSC)','Operations','2026-01-19 01:43:25');
INSERT INTO "topics" VALUES(15,'Business Studies (HSC)','Finance','2026-01-19 01:43:35');
INSERT INTO "topics" VALUES(16,'Business Studies (HSC)','Marketing','2026-01-19 01:43:40');
INSERT INTO "topics" VALUES(17,'Business Studies (HSC)','Human Resources','2026-01-19 01:43:50');
INSERT INTO "topics" VALUES(18,'Mathematics 3U','Sequences & Series','2026-01-19 03:22:22');
INSERT INTO "topics" VALUES(19,'Mathematics 3U','Calculus','2026-01-19 03:52:26');
INSERT INTO "topics" VALUES(20,'Economics','Year 11 Yearly','2026-02-03 09:05:01');
INSERT INTO "topics" VALUES(21,'Economics','Macroeconomics','2026-02-03 09:07:12');
INSERT INTO "topics" VALUES(22,'Economics','Microeconomics','2026-02-03 09:07:17');
INSERT INTO "topics" VALUES(23,'Mathematics 2U (HSC)','Circular geometry','2026-02-03 09:23:58');
INSERT INTO "topics" VALUES(24,'Mathematics 2U (HSC)','Integral calculus','2026-02-03 09:28:13');
INSERT INTO "topics" VALUES(25,'Mathematics 2U (HSC)','Differentiation','2026-02-03 09:28:34');
INSERT INTO "topics" VALUES(26,'Mathematics 2U (HSC)','Functions','2026-02-03 09:29:03');
INSERT INTO "topics" VALUES(27,'Mathematics 2U (HSC)','Graphing','2026-02-03 09:29:16');
INSERT INTO "topics" VALUES(28,'Mathematics 2U (HSC)','Linear functions','2026-02-03 09:29:48');
INSERT INTO "topics" VALUES(29,'Mathematics 2U (HSC)','Coordinate geometry','2026-02-03 09:36:01');
CREATE TABLE questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  question_image_key TEXT, 
  answer_image_key TEXT, 
  uploader_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, paper_tag TEXT, is_deleted BOOLEAN DEFAULT 0,
  FOREIGN KEY (topic_id) REFERENCES topics(id),
  FOREIGN KEY (uploader_id) REFERENCES users(id)
);
INSERT INTO "questions" VALUES(1,1,'questions/1767330110358-q-094lcttx784m','questions/1767330110961-a-cpbh1olerhc',2,'2026-01-02 05:01:51','Baulkham Hills 2010 Year 9 (testing) also how is this 3 sig fig',1);
CREATE TABLE essays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  subject TEXT NOT NULL,
  author_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, question TEXT, full_marks REAL, file_key TEXT, is_deleted BOOLEAN DEFAULT 0,
  FOREIGN KEY (author_id) REFERENCES users(id)
);
INSERT INTO "essays" VALUES(1,'do not buy iced espresso',replace(replace('Per the results of our market research, we hence deduced several factors that we believed would be most critical for our gayness, as this will benefit the gay film production of henrik in his english film assingment. When you really think about it, Henrik is animal farm’s key satirical figure due to his enormous jaws. When ninety three tiny cats chased Henrik out of the rowing sheds, Orwell uses the satirical image of Henrik’s mum to satirise the wealth inequality in African-Atlantic Regions, including Mr Fredrick’s farmyard iconography to evoke English audience’s nostalgic sentiment of homosexuality. This is further seen when Henrik is playing games not for his “selfishness and privilege” and when justified as “brainworkers” for his french beginners Orwell lampoons the use of homosexuality to justify political inaction.\r\n','\r',char(13)),'\n',char(10)),'Business Studies (HSC Accelerated)',2,'2026-01-03 04:08:19','discuss the quantum superstition of Macbeth',2,NULL,1);
INSERT INTO "essays" VALUES(2,'band 6 business studies essay mr higgins special','','Business Studies (HSC)',15,'2026-01-15 11:54:28','unsure',20,'essays/1768478064679-Sample_band_6_business_report__2_.pdf',1);
INSERT INTO "essays" VALUES(3,'mid tier animal farm essay',replace(replace('George Orwell''s Animal Farm chronicles the cathartic collapse of political ideals in a society plagued with corruption and propaganda. Orwell presents society''s cynical anxieties: he first highlights fears over the gradual erosion of ideals driven by leaders'' selfish ambition. This erosion fuels the manipulation of the truth to mask the leaders'' betrayal of revolutionary ideals. This ultimately confirms the reader''s anxiety over the unrestrained exploitation and betrayal of the people, a fear cathartically clarified with the betrayal of Boxer.\r\n\r\nOrwell clarifies the anxiety over the loss of ideals by highlighting the gradual, cynical erosion of the revolutionary principles. When the pigs begin sleeping on beds, Muriel reads out the altered commandment: ''No animal shall sleep in bed with sheets'' whose change ''Clover had not remembered...but as it was there on the wall, it must have done so''. Orwell utilises dramatic irony and an understatement of the corrupt betrayal of the workers reduced to Clover''s personal confusion to play to the reader''s shared, cathartic frustration with Clover and validate their social anxieties over the slow, unnoticed erosion of ideals to satisfy leaders'' indulgences. When the animals sing ''Beasts of England'' during a time of hardship, Squealer announces that ''"Beasts of England" is abolished'' and is replaced by Minimus'' song ''Animal Farm, Animal Farm, / Never through me shalt thou come to harm!''. Orwell parodies Stalin''s replacement of the original revolution anthem ''The Internationale'' with ''The State Anthem  of the Soviet Union'' to highlight the people''s ambition and ideal for a free, equal society that is immediately and ironically destroyed by Napoleon''s corrupt power, thus playing to the reader''s fear over their powerlessness in the manipulation of ideals shaped by political leaders. When Napoleon considers the fallen windmill, he asks ''"Comrades…do you know who is responsible for this? […] SNOWBALL!"''. Orwell applies dramatic irony and inflation to emphasise the hidden destruction of the animal''s hope for socialist freedom; this hope is instead exploited to encourage the animals to continue working to support Napoleon''s cynical goal of productivity and profits. Through the destruction of songs, hope and laws, Orwell clarifies the anxiety over the loss of ideals through emphasising leaders'' gradual erosion of principles to cynically solidify their power.\r\n\r\nOrwell then highlights how the loss of ideals can be masked through the manipulation of the truth by clouding the past and exploiting the working class'' submissive naivety. During a time of suffering for the animals, Squealer ''would read…lists of figures proving that the production…had increased'' and ''they could no longer remember…what conditions had been like before the Rebellion''. Orwell applies inflation and knaves and fools through the animal''s naivety to present the fear of the loss of connection with the past that can lead to the unrestrained manipulation of the present truth that leaves the people powerless and restricted by their leaders. When Squealer calls Snowball a traitor, Boxer says ''"If Comrade Napoleon says it, it must be right." And from then on he adopted the maxim, "Napoleon is  always right"''. Orwell characterises Boxer''s loyalty as blind and absolute even with his cognitive dissonance to highlight the fear of the anxiety over the loss of critical thought and submissive naivety of the masses that leaders can exploit to cloud ideals for their own gain as evident with Napoleon''s need for productivity and profits. When Clover considers the altered commandments, she says "My sight is failing" and that ''there was nothing there now except a single Commandment: ALL ANIMALS ARE EQUAL BUT SOME ANIMALS ARE MORE EQUAL THAN OTHERS.'' Orwell employs a paradoxical, verbal irony to lampoon the hypocrisy of the elites who preach equality yet hide the truth on their luxurious lives separated from the masses as evident with the Nomenklatura and British upper-class socialists Orwell was suspicious of. Through the exploitation of the working class'' naivety, Orwell highlights the reader''s fears over leaders'' manipulation of the truth to not only justify their cynical actions, but achieve unrestrained power.\r\n\r\nOrwell ultimately confirms the reader''s anxiety over leaders'' unchallenged exploitation and betrayal of the working class shown through the cathartic betrayal of Boxer. When the pigs justify their privilege, Squealer says that ''It is for your sake that we drink that milk and eat those apples'' or else ''Jones would come back!'' Orwell employs verbal irony to emphasise anxieties over leaders'' exploitation of the people to work while using a false threat to justify their own privileges without challenge or consequence. Furthermore, when Boxer is betrayed, Squealer presents a lie: ''I was at his bedside at the very last…his last words was…his sole sorrow to have passed on before the windmill was finished''. Orwell utilises dramatic irony to provide a crystal clear catharsis of the cynical fear of gaslighting and lies from powerful entities for their own gain and control. Finally, after Boxer''s death, ''the word went round that…the pigs had acquired the money to buy themselves another case of whisky''. Orwell utilises situational irony to provide a final catharsis through the ultimate betrayal of Boxer''s hardworking, idealistic labour to fund the luxuries of the leaders to confirm the reader''s anxiety over the exploitation of the people.  Through the cathartic betrayal of Boxer, Orwell highlights the reader''s anxiety over leaders'' unchallenged cycle of exploitation that will ultimately lead to endless suffering for the working class.\r\n\r\nIn conclusion, Orwell''s explores devastating consequences of a society plagued with propaganda  and corruption. Orwell presents the reader''s cynical anxieties: he first emphasises the gradual erosion of revolutionary principles highlights the leaders'' exploitation of ideals to satisfy their own cynical goals. This erosion is masked with the unchallenged manipulation of the truth that clouds the past and justifies leaders'' growing cynicism. Orwell ultimately confirms the audience''s deepest fear over the complete betrayal of the people that solidifies the leaders'' power and exacerbates the working class'' suffering. This shows that the endless battle against tyranny is a battle that is never truly won.\r\n','\r',char(13)),'\n',char(10)),'English Advanced',15,'2026-01-15 12:11:22',replace(replace('The best satire is cathartic: it expresses our deepest social anxieties with\r\ncrystal clarity.\r\nIn what way is this true of your understanding of Animal Farm? ','\r',char(13)),'\n',char(10)),20,NULL,1);
INSERT INTO "essays" VALUES(4,'teacher dialetical sample',replace(replace('Shakespeare’s Julius Caesar explores the\r\nvalues of its characters – all of whom are\r\nembroiled in a battle for power in the dying\r\ndays of the Roman republic. While Brutus\r\nappears to be a principled protagonist to\r\nanchor the play’s values, his concern for the\r\nlegacy of his name shows a selfish interest in\r\nhis central role in Roman politics. But Mark\r\nAntony’s call to “let slip the dogs of war”\r\nreveals a central moment of emotion that\r\ndefines the play beyond any deeper motivation\r\nthan fury. In his dramatisation of Rome’s\r\nfall Shakespeare ultimately shows that\r\nneither values nor will-to-power are the\r\ncentral human concern of the play, but\r\nrather our very human emotional\r\nlandscapes.','\r',char(13)),'\n',char(10)),'English Advanced',15,'2026-01-15 12:17:34',replace(replace('To what extent does Shakespeare’s Julius Caesar\r\npresent a conflict between power and values?\r\n','\r',char(13)),'\n',char(10)),20,NULL,1);
INSERT INTO "essays" VALUES(5,'teacher simplistic structure sample',replace(replace('Shakespeare’s Julius Caesar shows a\r\nconflict between power and values through\r\nthe figures of Antony and Brutus, who\r\nclash over control of the people of Rome.\r\nThe play portrays Antony as a\r\nmanipulative public figure who uses\r\nrhetoric to gain power over all other\r\nvalues. Through Antony’s strong and\r\nsuccessful will to power, Brutus’ adherence\r\nto his values seems tragic by comparison.\r\nTherefore, Shakespeare depicts the\r\ntriumph of power as a value in itself –\r\na value that obliterates other values.','\r',char(13)),'\n',char(10)),'English Advanced',15,'2026-01-15 12:22:45',replace(replace('To what extent does Shakespeare’s Julius Caesar\r\npresent a conflict between power and values?\r\n','\r',char(13)),'\n',char(10)),NULL,NULL,1);
INSERT INTO "essays" VALUES(6,'20/20 Business Study Exemplar','','Business Studies (HSC)',15,'2026-01-15 12:31:57',replace(replace('Guidelines For Marking\r\nYour answer will be assessed on how well you:\r\n• Demonstrate knowledge and understanding relevant to the question\r\n• Apply the hypothetical business situation\r\n• Communicate using relevant business terminology and concepts\r\n• Present a sustained, logical and cohesive response in the form of a business report\r\nHypothetical Business Situation\r\nDawn Pty Ltd is an established manufacturing business that produces a wide range of high quality and premium vegan\r\ncandles made from soy wax (made from soybean oil) instead of the traditional beeswax. Dawn Pty Ltd is expanding\r\ninto global markets. It will lease warehouses in Malaysia and the USA. The company has provided you with a recently\r\ncompleted SWOT analysis.\r\nSWOT analysis\r\nStrengths\r\n• High quality, premium and vegan candle products\r\n• A variety of scents and fragrances including\r\nlavender, cranberry and tofu\r\n• Made from Australian-grown soybeans instead of\r\ntraditional beeswax\r\nWeaknesses\r\n• Frequent breakage of product during transportation\r\n• Lack of experience in foreign markets\r\nOpportunities\r\n• Expanding market for high quality candles in\r\ncountries overseas\r\n• Falling bee populations overseas\r\n• Potential collaborations with opinion leaders for\r\nsponsorship and endorsement\r\nThreats\r\n• Established competition in foreign markets\r\n• Fluctuations in the value of the Australian Dollar\r\nYou have been hired as a consultant by Dawn Pty Ltd to write a business report for the owners. In your report:\r\n• Outline the interdependence of marketing with EITHER operations OR marketing OR human resources.\r\n• Explain why ethical behaviour AND/OR consumer laws are important in marketing.\r\n• Recommend TWO marketing strategies that for the business','\r',char(13)),'\n',char(10)),20,'essays/1768480314341-Marketing_Business_Report_Exemplar_1.pdf',1);
INSERT INTO "essays" VALUES(7,'20/20 bus essay #2','','Business Studies (HSC)',15,'2026-01-15 12:33:01',replace(replace('Guidelines For Marking\r\nYour answer will be assessed on how well you:\r\n• Demonstrate knowledge and understanding relevant to the question\r\n• Apply the hypothetical business situation\r\n• Communicate using relevant business terminology and concepts\r\n• Present a sustained, logical and cohesive response in the form of a business report\r\nHypothetical Business Situation\r\nDawn Pty Ltd is an established manufacturing business that produces a wide range of high quality and premium vegan\r\ncandles made from soy wax (made from soybean oil) instead of the traditional beeswax. Dawn Pty Ltd is expanding\r\ninto global markets. It will lease warehouses in Malaysia and the USA. The company has provided you with a recently\r\ncompleted SWOT analysis.\r\nSWOT analysis\r\nStrengths\r\n• High quality, premium and vegan candle products\r\n• A variety of scents and fragrances including\r\nlavender, cranberry and tofu\r\n• Made from Australian-grown soybeans instead of\r\ntraditional beeswax\r\nWeaknesses\r\n• Frequent breakage of product during transportation\r\n• Lack of experience in foreign markets\r\nOpportunities\r\n• Expanding market for high quality candles in\r\ncountries overseas\r\n• Falling bee populations overseas\r\n• Potential collaborations with opinion leaders for\r\nsponsorship and endorsement\r\nThreats\r\n• Established competition in foreign markets\r\n• Fluctuations in the value of the Australian Dollar\r\nYou have been hired as a consultant by Dawn Pty Ltd to write a business report for the owners. In your report:\r\n• Outline the interdependence of marketing with EITHER operations OR marketing OR human resources.\r\n• Explain why ethical behaviour AND/OR consumer laws are important in marketing.\r\n• Recommend TWO marketing strategies that for the business','\r',char(13)),'\n',char(10)),NULL,'essays/1768480379033-Marketing_Business_Report_Exemplar_2.pdf',1);
INSERT INTO "essays" VALUES(8,'Marketing Mix + McDonald''s Case Study',replace(replace('Marketing is a strategy available to all businesses which aims to design, promote and reaffirm their product in the mind of the consumer. The role of marketing is vital in achieving a competitive advantage as it can determine whether a product stands out to consumers within a competitive market. McDonalds uses marketing mix and target market in order to sustain their position in the market. \r\n\r\nPrice is an essential part of marketing and falls within the category of the marketing mix. Price is the money value of which sellers are willing to accept and consumers are willing to pay for a product on the market. Price can be detrimental in gaining a competitive advantage as it determines whether the consumer will purchase the product. Brands use 3 main pricing methods including competition based pricing, marketing pricing and skim pricing to determine the final cost of their product. Brands also use multiple pricing strategies behind these methods in order to persuade a customer to purchase their product. McDonalds uses the pricing strategy of loss leaders to gain competitive advantage. They do this by setting the price of their output below the price of producing the product. With the introduction of the loose change menu, McDonalds has successfully implemented the loss leaders strategy as it persuades customers to purchase a cheaper item such as the $1 frozen coke with a more expensive item such as nuggets. The loose change menu ultimately aims to provide affordable options for customers of all backgrounds, therefore satisfying a wide range of customers’ needs. This gains consumer recognition, further increasing income and therefore leading to a competitive advantage against other fast food chains. Through the use of pricing methods and strategies, all businesses can meet their goal of reducing cost, maximising profits, increasing efficiency and gaining customer recognition to achieve a competitive advantage. \r\n\r\nPromotion is another vital aspect of marketing that falls under the category of marketing mix. Promotion aims to reaffirm the businesses product in the mind of the consumer through reminding, persuading and informing them of the product on offer in the market. Businesses use many promotion strategies including personal selling, publicity, sales promotion and advertising to gain a competitive advantage in the highly competitive market. McDonalds uses promotion strategies to persuade customers to purchase their products, however in some cases, this has taken a turn for McDonalds. McDonalds has received negative publicity (free news articles and stories for the public) which have completely tarnished their reputation. McDonalds received negative publicity from the series ‘Super Size Me’, the ‘McLibel’ case and also the China Meat Scandal. All of these instances have put McDonalds in a threatening position, leading to a competitive disadvantage as it pushed customers away from purchasing their products. However, through positive advertising, sales promotion and publicity, McDonalds has been able to bounce back and regain a competitive advantage. This has been achieved through strategic TV and radio advertising, discounts such as ‘30 days 30 deals’ and charitable work such as ‘Ronald McDonald House’. The implementation of charity also links to McDonalds ethical business behaviours, further impacting their success of a competitive advantage. Therefore, through the use of promotional strategies, businesses’ can ultimately persuade and remind loyal or future customers to purchase their products, resulting in the achievement of business goals and overall gaining and competitive advantage. \r\n\r\nProduct is also part of the marketing mix and is the output (good, service, or idea) of which a business displays on the market. It aims to meet the needs of customers'' expectations and overall generate income for a business. McDonald has used geographical location as a product strategy as they have expanded their menu depending on cultural and religious factors. This strategy has allowed McDonalds to expand their target market, ultimately gaining attention of a variety of customers and therefore generating increasing income globally. McDonalds also uses contraction to remove products that aren''t successful. McDonald''s decided to remove the choc top from the menu as it was not generating a continuous income. Instead, they focused on the improvement of quality and rejuvenation of other popular ice cream products such as the McFlurry. Through using operational analysis and data of their successful and unsuccessful products, McDonalds has been able to attract many customers as well as reducing manufacturing costs in order to sustain and generate greater income, ultimately leading to a competitive advantage. \r\n\r\nThrough the use of marketing mix; promotion, price, product and place, businesses are able to broaden their target market and generate greater profitability, leading to a competitive advantage in the market. Through using pricing strategies such as loss leaders, promotion strategies such as advertising and sales promotions, and product strategies such as contraction, rejuvenation and geographic location, mcDonalds has successfully expanded their target market. This expansion has led to the achievement of business goals such as reducing costs, generating income and satisfying a broad range of customers, therefore resulting in a competitive advantage against similar businesses within the market.','\r',char(13)),'\n',char(10)),'Business Studies',20,'2026-02-03 09:29:01','How does the marketing mix aid a business in gaining a competitive advantage? Use relevant case studies',0,NULL,0);
CREATE TABLE essay_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  essay_id INTEGER,
  content TEXT NOT NULL,
  author_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, grade REAL, is_deleted BOOLEAN DEFAULT 0,
  FOREIGN KEY (essay_id) REFERENCES essays(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
);
INSERT INTO "essay_comments" VALUES(1,1,'constructive feedback',2,'2026-01-03 04:08:46',99,0);
INSERT INTO "essay_comments" VALUES(2,1,'who is macbeth?',8,'2026-01-03 05:14:47',1,0);
INSERT INTO "essay_comments" VALUES(3,2,'its a report not essay',15,'2026-01-15 11:55:21',0,1);
INSERT INTO "essay_comments" VALUES(4,1,'masturpeice',17,'2026-01-21 04:42:08',2,0);
INSERT INTO "essay_comments" VALUES(5,8,'Could be more clear on what exactly ''McDonalds'' is.',20,'2026-02-03 09:37:32',0,0);
CREATE TABLE action_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action_type TEXT NOT NULL,
  details TEXT,
  target_id INTEGER,
  target_table TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
INSERT INTO "action_logs" VALUES(1,2,'DELETE_ANNOUNCEMENT','Deleted announcement 1',1,'announcements','2026-01-05 10:16:29');
INSERT INTO "action_logs" VALUES(2,9,'CREATE_POST','Created question ''We need to use IQTVE for year 11 and year 12'' in English Advanced',3,'posts','2026-01-05 10:21:52');
INSERT INTO "action_logs" VALUES(3,9,'CREATE_COMMENT','Commented on post 3',3,'comments','2026-01-05 10:22:26');
INSERT INTO "action_logs" VALUES(4,1,'CREATE_ANNOUNCEMENT','Created announcement ''t'' in All',4,'announcements','2026-01-12 00:38:06');
INSERT INTO "action_logs" VALUES(5,1,'DELETE_ANNOUNCEMENT','Deleted announcement 4',4,'announcements','2026-01-12 00:38:10');
INSERT INTO "action_logs" VALUES(6,1,'DELETE_QUESTION','Deleted question 1',1,'questions','2026-01-14 04:27:16');
INSERT INTO "action_logs" VALUES(7,1,'DELETE_POST','Deleted post 1',1,'posts','2026-01-14 04:27:35');
INSERT INTO "action_logs" VALUES(8,1,'DELETE_ANNOUNCEMENT','Deleted announcement 3',3,'announcements','2026-01-14 07:29:13');
INSERT INTO "action_logs" VALUES(9,1,'DELETE_ANNOUNCEMENT','Deleted announcement 2',2,'announcements','2026-01-14 07:29:20');
INSERT INTO "action_logs" VALUES(10,1,'CREATE_PAPER','Created paper Sydney Boys High School 2001',1,'papers','2026-01-14 07:45:28');
INSERT INTO "action_logs" VALUES(11,1,'BATCH_UPDATE_QUESTIONS','Batch updated 28 questions in paper 1',1,'papers','2026-01-14 07:59:53');
INSERT INTO "action_logs" VALUES(12,1,'BATCH_UPDATE_QUESTIONS','Batch updated 28 questions in paper 1',1,'papers','2026-01-14 08:01:22');
INSERT INTO "action_logs" VALUES(13,1,'BATCH_UPDATE_QUESTIONS','Batch updated 28 questions in paper 1',1,'papers','2026-01-14 08:02:15');
INSERT INTO "action_logs" VALUES(14,1,'BATCH_UPDATE_QUESTIONS','Batch updated 28 questions in paper 1',1,'papers','2026-01-14 08:03:49');
INSERT INTO "action_logs" VALUES(15,1,'BATCH_UPDATE_QUESTIONS','Batch updated 28 questions in paper 1',1,'papers','2026-01-14 08:04:00');
INSERT INTO "action_logs" VALUES(16,1,'BATCH_UPDATE_QUESTIONS','Batch updated 28 questions in paper 1',1,'papers','2026-01-15 03:11:00');
INSERT INTO "action_logs" VALUES(17,15,'SUBMIT_ESSAY','Submitted essay ''band 6 business studies essay mr higgins special'' in Business Studies (HSC)',2,'essays','2026-01-15 11:54:28');
INSERT INTO "action_logs" VALUES(18,15,'SUBMIT_FEEDBACK','Feedback on essay 2',3,'essay_comments','2026-01-15 11:55:21');
INSERT INTO "action_logs" VALUES(19,15,'SUBMIT_ESSAY','Submitted essay ''mid tier animal farm essay'' in English Advanced',3,'essays','2026-01-15 12:11:23');
INSERT INTO "action_logs" VALUES(20,15,'SUBMIT_ESSAY','Submitted essay ''teacher dialetical sample'' in English Advanced',4,'essays','2026-01-15 12:17:34');
INSERT INTO "action_logs" VALUES(21,15,'DELETE_FEEDBACK','Deleted feedback 3',3,'essay_comments','2026-01-15 12:19:48');
INSERT INTO "action_logs" VALUES(22,15,'CREATE_POST','Created question ''only for prestudy gods'' in English Advanced',4,'posts','2026-01-15 12:21:05');
INSERT INTO "action_logs" VALUES(23,15,'SUBMIT_ESSAY','Submitted essay ''teacher simplistic structure sample'' in English Advanced',5,'essays','2026-01-15 12:22:46');
INSERT INTO "action_logs" VALUES(24,15,'CREATE_COMMENT','Commented on post 3',4,'comments','2026-01-15 12:28:37');
INSERT INTO "action_logs" VALUES(25,15,'CREATE_COMMENT','Commented on post 2',5,'comments','2026-01-15 12:29:30');
INSERT INTO "action_logs" VALUES(26,15,'CREATE_COMMENT','Commented on post 2',6,'comments','2026-01-15 12:29:34');
INSERT INTO "action_logs" VALUES(27,15,'CREATE_COMMENT','Commented on post 2',7,'comments','2026-01-15 12:29:38');
INSERT INTO "action_logs" VALUES(28,15,'CREATE_COMMENT','Commented on post 2',8,'comments','2026-01-15 12:29:42');
INSERT INTO "action_logs" VALUES(29,15,'CREATE_COMMENT','Commented on post 2',9,'comments','2026-01-15 12:29:46');
INSERT INTO "action_logs" VALUES(30,15,'CREATE_COMMENT','Commented on post 2',10,'comments','2026-01-15 12:29:50');
INSERT INTO "action_logs" VALUES(31,15,'CREATE_COMMENT','Commented on post 2',11,'comments','2026-01-15 12:29:54');
INSERT INTO "action_logs" VALUES(32,15,'CREATE_COMMENT','Commented on post 2',12,'comments','2026-01-15 12:30:00');
INSERT INTO "action_logs" VALUES(33,15,'CREATE_COMMENT','Commented on post 2',13,'comments','2026-01-15 12:30:05');
INSERT INTO "action_logs" VALUES(34,15,'CREATE_COMMENT','Commented on post 2',14,'comments','2026-01-15 12:30:09');
INSERT INTO "action_logs" VALUES(35,15,'CREATE_COMMENT','Commented on post 2',15,'comments','2026-01-15 12:30:14');
INSERT INTO "action_logs" VALUES(36,15,'SUBMIT_ESSAY','Submitted essay ''20/20 Business Study Exemplar'' in Business Studies (HSC)',6,'essays','2026-01-15 12:31:57');
INSERT INTO "action_logs" VALUES(37,15,'SUBMIT_ESSAY','Submitted essay ''20/20 bus essay #2'' in Business Studies (HSC)',7,'essays','2026-01-15 12:33:01');
INSERT INTO "action_logs" VALUES(38,15,'DELETE_ESSAY','Deleted essay 7',7,'essays','2026-01-15 12:53:48');
INSERT INTO "action_logs" VALUES(39,15,'DELETE_ESSAY','Deleted essay 6',6,'essays','2026-01-15 12:53:53');
INSERT INTO "action_logs" VALUES(40,15,'DELETE_ESSAY','Deleted essay 2',2,'essays','2026-01-15 12:53:57');
INSERT INTO "action_logs" VALUES(41,15,'DELETE_ESSAY','Deleted essay 5',5,'essays','2026-01-15 12:54:03');
INSERT INTO "action_logs" VALUES(42,15,'DELETE_ESSAY','Deleted essay 4',4,'essays','2026-01-15 12:54:08');
INSERT INTO "action_logs" VALUES(43,15,'DELETE_ESSAY','Deleted essay 3',3,'essays','2026-01-15 12:54:21');
INSERT INTO "action_logs" VALUES(44,15,'DELETE_POST','Deleted post 4',4,'posts','2026-01-15 12:54:38');
INSERT INTO "action_logs" VALUES(45,15,'DELETE_COMMENT','Deleted comment 4',4,'comments','2026-01-15 12:54:44');
INSERT INTO "action_logs" VALUES(46,15,'DELETE_COMMENT','Deleted comment 5',5,'comments','2026-01-15 22:14:17');
INSERT INTO "action_logs" VALUES(47,15,'DELETE_COMMENT','Deleted comment 6',6,'comments','2026-01-15 22:14:21');
INSERT INTO "action_logs" VALUES(48,15,'DELETE_COMMENT','Deleted comment 7',7,'comments','2026-01-15 22:14:24');
INSERT INTO "action_logs" VALUES(49,15,'DELETE_COMMENT','Deleted comment 8',8,'comments','2026-01-15 22:14:27');
INSERT INTO "action_logs" VALUES(50,15,'DELETE_COMMENT','Deleted comment 9',9,'comments','2026-01-15 22:14:29');
INSERT INTO "action_logs" VALUES(51,15,'DELETE_COMMENT','Deleted comment 10',10,'comments','2026-01-15 22:14:32');
INSERT INTO "action_logs" VALUES(52,15,'DELETE_COMMENT','Deleted comment 11',11,'comments','2026-01-15 22:14:34');
INSERT INTO "action_logs" VALUES(53,15,'DELETE_COMMENT','Deleted comment 12',12,'comments','2026-01-15 22:14:37');
INSERT INTO "action_logs" VALUES(54,15,'DELETE_COMMENT','Deleted comment 13',13,'comments','2026-01-15 22:14:40');
INSERT INTO "action_logs" VALUES(55,15,'DELETE_COMMENT','Deleted comment 14',14,'comments','2026-01-15 22:14:44');
INSERT INTO "action_logs" VALUES(56,15,'DELETE_COMMENT','Deleted comment 15',15,'comments','2026-01-15 22:14:48');
INSERT INTO "action_logs" VALUES(57,16,'CREATE_POST','Created question ''When are yearlys for y11'' in All',5,'posts','2026-01-16 02:58:36');
INSERT INTO "action_logs" VALUES(58,1,'BATCH_UPDATE_QUESTIONS','Batch updated 28 questions in paper 1',1,'papers','2026-01-16 04:22:13');
INSERT INTO "action_logs" VALUES(59,1,'ADD_QUESTION','Added question A11 to paper 1',1,'papers','2026-01-16 04:42:14');
INSERT INTO "action_logs" VALUES(60,1,'REMOVE_QUESTION','Removed question A11 from paper 1',1,'papers','2026-01-16 04:42:28');
INSERT INTO "action_logs" VALUES(61,1,'ADD_QUESTION','Added question B7 to paper 1',1,'papers','2026-01-16 04:45:01');
INSERT INTO "action_logs" VALUES(62,1,'ADD_QUESTION','Added question C6 to paper 1',1,'papers','2026-01-16 04:47:04');
INSERT INTO "action_logs" VALUES(63,1,'BATCH_UPDATE_QUESTIONS','Batch updated 30 questions in paper 1',1,'papers','2026-01-16 04:54:19');
INSERT INTO "action_logs" VALUES(64,1,'REMOVE_QUESTION','Removed question C6 from paper 1',1,'papers','2026-01-16 04:54:40');
INSERT INTO "action_logs" VALUES(65,1,'BATCH_UPDATE_QUESTIONS','Batch updated 29 questions in paper 1',1,'papers','2026-01-16 04:55:53');
INSERT INTO "action_logs" VALUES(66,1,'BATCH_UPDATE_QUESTIONS','Batch updated 29 questions in paper 1',1,'papers','2026-01-16 05:03:28');
INSERT INTO "action_logs" VALUES(67,1,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 1',1,'papers','2026-01-16 05:12:41');
INSERT INTO "action_logs" VALUES(68,1,'ADD_QUESTION','Added question D4 to paper 1',1,'papers','2026-01-16 05:13:46');
INSERT INTO "action_logs" VALUES(69,1,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 1',1,'papers','2026-01-16 05:14:34');
INSERT INTO "action_logs" VALUES(70,1,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 1',1,'papers','2026-01-16 05:16:14');
INSERT INTO "action_logs" VALUES(71,1,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 1',1,'papers','2026-01-16 05:19:52');
INSERT INTO "action_logs" VALUES(72,1,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 1',1,'papers','2026-01-16 05:24:39');
INSERT INTO "action_logs" VALUES(73,1,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 1',1,'papers','2026-01-16 05:28:08');
INSERT INTO "action_logs" VALUES(74,1,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 1',1,'papers','2026-01-16 05:34:18');
INSERT INTO "action_logs" VALUES(75,1,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 1',1,'papers','2026-01-16 05:38:14');
INSERT INTO "action_logs" VALUES(76,1,'LOCK_PAPER','Locked paper 1',1,'papers','2026-01-16 05:39:16');
INSERT INTO "action_logs" VALUES(77,1,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 1',1,'papers','2026-01-17 23:40:37');
INSERT INTO "action_logs" VALUES(78,1,'CREATE_PAPER','Created paper Sydney Boys High School 2013',2,'papers','2026-01-19 01:41:47');
INSERT INTO "action_logs" VALUES(79,1,'IMPORT_TEXT','Fresh Import: Wiped previous questions. 36 inserted.',2,'papers','2026-01-19 01:41:56');
INSERT INTO "action_logs" VALUES(80,1,'IMPORT_TEXT','Fresh Import: Wiped previous questions. 36 inserted.',2,'papers','2026-01-19 01:43:13');
INSERT INTO "action_logs" VALUES(81,1,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 2',2,'papers','2026-01-19 01:44:40');
INSERT INTO "action_logs" VALUES(82,1,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 2',2,'papers','2026-01-19 01:46:14');
INSERT INTO "action_logs" VALUES(83,1,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 2',2,'papers','2026-01-19 01:53:46');
INSERT INTO "action_logs" VALUES(84,17,'CREATE_PAPER','Created paper Sydney Boys High School 2014',3,'papers','2026-01-19 03:14:28');
INSERT INTO "action_logs" VALUES(85,17,'ADD_QUESTION','Added question A17 to paper 3',3,'papers','2026-01-19 03:17:22');
INSERT INTO "action_logs" VALUES(86,17,'ADD_QUESTION','Added question A18 to paper 3',3,'papers','2026-01-19 03:18:29');
INSERT INTO "action_logs" VALUES(87,17,'ADD_QUESTION','Added question A19 to paper 3',3,'papers','2026-01-19 03:19:20');
INSERT INTO "action_logs" VALUES(88,17,'ADD_QUESTION','Added question A20 to paper 3',3,'papers','2026-01-19 03:19:28');
INSERT INTO "action_logs" VALUES(89,17,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 3',3,'papers','2026-01-19 03:20:41');
INSERT INTO "action_logs" VALUES(90,17,'ADD_QUESTION','Added question A21 to paper 3',3,'papers','2026-01-19 03:21:35');
INSERT INTO "action_logs" VALUES(91,1,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 2',2,'papers','2026-01-19 03:21:46');
INSERT INTO "action_logs" VALUES(92,17,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 3',3,'papers','2026-01-19 03:22:48');
INSERT INTO "action_logs" VALUES(93,1,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 2',2,'papers','2026-01-19 03:24:34');
INSERT INTO "action_logs" VALUES(94,1,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 2',2,'papers','2026-01-19 03:29:10');
INSERT INTO "action_logs" VALUES(95,17,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 3',3,'papers','2026-01-19 03:29:36');
INSERT INTO "action_logs" VALUES(96,1,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 2',2,'papers','2026-01-19 03:29:42');
INSERT INTO "action_logs" VALUES(97,1,'LOCK_PAPER','Locked paper 2',2,'papers','2026-01-19 03:29:46');
INSERT INTO "action_logs" VALUES(98,17,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 3',3,'papers','2026-01-19 03:31:29');
INSERT INTO "action_logs" VALUES(99,17,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 3',3,'papers','2026-01-19 03:34:09');
INSERT INTO "action_logs" VALUES(100,17,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 3',3,'papers','2026-01-19 03:35:44');
INSERT INTO "action_logs" VALUES(101,17,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 3',3,'papers','2026-01-19 03:41:50');
INSERT INTO "action_logs" VALUES(102,17,'LOCK_PAPER','Locked paper 3',3,'papers','2026-01-19 03:42:28');
INSERT INTO "action_logs" VALUES(103,17,'CREATE_PAPER','Created paper Sydney Boys High School 2023',4,'papers','2026-01-19 09:08:09');
INSERT INTO "action_logs" VALUES(104,17,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 4',4,'papers','2026-01-19 09:12:44');
INSERT INTO "action_logs" VALUES(105,17,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 4',4,'papers','2026-01-19 10:12:09');
INSERT INTO "action_logs" VALUES(106,17,'CREATE_ANNOUNCEMENT','Created announcement ''test announcement'' in Mathematics 3U',5,'announcements','2026-01-21 04:39:33');
INSERT INTO "action_logs" VALUES(107,17,'CREATE_POST','Created question ''when are math classes releasing'' in Mathematics 3U',6,'posts','2026-01-21 04:41:06');
INSERT INTO "action_logs" VALUES(108,17,'SUBMIT_FEEDBACK','Feedback on essay 1',4,'essay_comments','2026-01-21 04:42:08');
INSERT INTO "action_logs" VALUES(109,1,'DELETE_ANNOUNCEMENT','Deleted announcement ''test announcement''',5,'announcements','2026-02-03 07:52:00');
INSERT INTO "action_logs" VALUES(110,1,'DELETE_ESSAY','Deleted essay 1',1,'essays','2026-02-03 07:52:20');
INSERT INTO "action_logs" VALUES(111,9,'CREATE_PAPER','Created paper Sydney Grammar School 2026',5,'papers','2026-02-03 08:55:21');
INSERT INTO "action_logs" VALUES(112,9,'CREATE_PAPER','Created paper Sydney Grammar School  2015',6,'papers','2026-02-03 08:56:04');
INSERT INTO "action_logs" VALUES(113,9,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 6',6,'papers','2026-02-03 08:57:50');
INSERT INTO "action_logs" VALUES(114,9,'ADD_QUESTION','Added question A21 to paper 6',6,'papers','2026-02-03 08:59:55');
INSERT INTO "action_logs" VALUES(115,9,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 6',6,'papers','2026-02-03 09:01:38');
INSERT INTO "action_logs" VALUES(116,20,'CREATE_RESOURCE','Uploaded resource ''Anki Flashcards - Role of Business'' in Business Studies',2,'resources','2026-02-03 09:12:44');
INSERT INTO "action_logs" VALUES(117,9,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 6',6,'papers','2026-02-03 09:13:21');
INSERT INTO "action_logs" VALUES(118,20,'CREATE_COMMENT','Commented on post 5',16,'comments','2026-02-03 09:19:57');
INSERT INTO "action_logs" VALUES(119,5,'CREATE_PAPER','Created paper James Ruse Agricultural High School 2018',7,'papers','2026-02-03 09:20:44');
INSERT INTO "action_logs" VALUES(120,9,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 6',6,'papers','2026-02-03 09:25:37');
INSERT INTO "action_logs" VALUES(121,20,'SUBMIT_ESSAY','Submitted essay ''Marketing Mix + McDonald''s Case Study'' in Business Studies',8,'essays','2026-02-03 09:29:01');
INSERT INTO "action_logs" VALUES(122,5,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 7',7,'papers','2026-02-03 09:34:20');
INSERT INTO "action_logs" VALUES(123,20,'CREATE_PAPER','Created paper Sydney Boys High School 2022',8,'papers','2026-02-03 09:34:29');
INSERT INTO "action_logs" VALUES(124,5,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 7',7,'papers','2026-02-03 09:34:45');
INSERT INTO "action_logs" VALUES(125,20,'SUBMIT_FEEDBACK','Feedback on essay 8',5,'essay_comments','2026-02-03 09:37:32');
INSERT INTO "action_logs" VALUES(126,5,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 7',7,'papers','2026-02-03 09:38:01');
INSERT INTO "action_logs" VALUES(127,5,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 7',7,'papers','2026-02-03 09:40:32');
INSERT INTO "action_logs" VALUES(128,20,'CREATE_RESOURCE','Uploaded resource ''Anki Flashcards - Role of Marketing'' in Business Studies (HSC)',3,'resources','2026-02-03 09:41:40');
INSERT INTO "action_logs" VALUES(129,5,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 7',7,'papers','2026-02-03 09:46:19');
INSERT INTO "action_logs" VALUES(130,5,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 7',7,'papers','2026-02-03 09:50:44');
INSERT INTO "action_logs" VALUES(131,5,'BATCH_UPDATE_QUESTIONS','Batch updated questions in paper 7',7,'papers','2026-02-03 09:53:13');
INSERT INTO "action_logs" VALUES(132,25,'CREATE_POST','Created question ''can you can a can faster than a canner can can a can'' in All',7,'posts','2026-02-08 21:31:26');
INSERT INTO "action_logs" VALUES(133,17,'CREATE_ANNOUNCEMENT','Created announcement ''ban list when'' in Mathematics 3U',6,'announcements','2026-02-09 21:40:05');
INSERT INTO "action_logs" VALUES(134,27,'CREATE_COMMENT','Commented on post 7',17,'comments','2026-02-12 03:03:20');
INSERT INTO "action_logs" VALUES(135,3,'DELETE_ANNOUNCEMENT','Deleted announcement ''ban list when''',6,'announcements','2026-02-12 04:29:29');
INSERT INTO "action_logs" VALUES(136,3,'DELETE_POST','Deleted post 6',6,'posts','2026-02-12 04:30:10');
INSERT INTO "action_logs" VALUES(137,3,'CREATE_ANNOUNCEMENT','Created announcement ''HighHelp v.0.0.1 Release'' in Other',7,'announcements','2026-02-12 08:11:39');
INSERT INTO "action_logs" VALUES(138,5,'CREATE_RESOURCE','Uploaded resource ''Chapter 1: Intro to Economics/The Economic Problem flashcards'' in Economics',4,'resources','2026-02-14 03:32:08');
INSERT INTO "action_logs" VALUES(139,3,'CREATE_RESOURCE','Uploaded resource ''Circuit Symbols Anki Cards'' in Software Engineering',5,'resources','2026-02-15 02:34:08');
CREATE TABLE papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    school_name TEXT NOT NULL,
    academic_year INTEGER NOT NULL,
    reference_link TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
, paper_type TEXT DEFAULT 'Trial Paper', is_locked BOOLEAN DEFAULT 0);
INSERT INTO "papers" VALUES(1,'Mathematics 3U','Sydney Boys High School',2001,'https://thsconline.github.io/s/d/5238/Sydney%20Boys%202001%20w.%20sol','2026-01-14 07:45:28','Yearly',1);
INSERT INTO "papers" VALUES(2,'Business Studies (HSC)','Sydney Boys High School',2013,'','2026-01-19 01:41:47','Trial Paper',1);
INSERT INTO "papers" VALUES(3,'Mathematics 3U','Sydney Boys High School',2014,'https://thsconline.github.io/s/v/5228/Sydney%20Boys%202014%20w.%20sol','2026-01-19 03:14:27','Yearly',1);
INSERT INTO "papers" VALUES(4,'Mathematics 3U','Sydney Boys High School',2023,'','2026-01-19 09:08:09','Assessment Task',0);
INSERT INTO "papers" VALUES(5,'Economics','Sydney Grammar School',2026,'https://thsconline.github.io/s/v/2468/Sydney%20Grammar%202015%20w.%20sol','2026-02-03 08:55:20','Yearly',0);
INSERT INTO "papers" VALUES(6,'Economics','Sydney Grammar School ',2015,'https://thsconline.github.io/s/v/2468/Sydney%20Grammar%202015%20w.%20sol','2026-02-03 08:56:04','Yearly',0);
INSERT INTO "papers" VALUES(7,'Mathematics 2U (HSC)','James Ruse Agricultural High School',2018,'https://thsconline.github.io/s/v/5328/James%20Ruse%202018%20w.%20sol','2026-02-03 09:20:44','Trial Paper',0);
INSERT INTO "papers" VALUES(8,'Business Studies','Sydney Boys High School',2022,'','2026-02-03 09:34:29','Yearly',0);
CREATE TABLE exam_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paper_id INTEGER NOT NULL,
    section_label TEXT NOT NULL, 
    segment_label TEXT, 
    question_number TEXT NOT NULL, 
    question_full_label TEXT, 
    question_type TEXT, 
    marks INTEGER,
    question_image_key TEXT,
    answer_image_key TEXT,
    stimulus_image_key TEXT,
    mc_answer TEXT, 
    uploader_id INTEGER,
    is_deleted BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ordering_index REAL DEFAULT 0, question_text TEXT, answer_text TEXT, stimulus_text TEXT,
    FOREIGN KEY (paper_id) REFERENCES papers(id),
    FOREIGN KEY (uploader_id) REFERENCES users(id)
);
INSERT INTO "exam_questions" VALUES(1,1,'II','A','A1','II A1','short_answer',1,'questions/1768377588954-question-vvyelpv3c9e','questions/1768377589135-answer-m32d0n3o6n',NULL,NULL,1,0,'2026-01-14 07:45:28',1,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(2,1,'II','A','A2','II A2','short_answer',1,'questions/1768377589449-question-pbu8pwcj5e','questions/1768377679510-answer-bszo987fjv9',NULL,NULL,1,0,'2026-01-14 07:45:28',2,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(3,1,'II','A','A3','II A3','short_answer',2,'questions/1768377589707-question-msrt21fcxvj','questions/1768377679878-answer-j6tn777bkad',NULL,NULL,1,0,'2026-01-14 07:45:28',3,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(4,1,'II','A','A4','II A4','short_answer',1,'questions/1768377589976-question-3zdadowvztt','questions/1768377680206-answer-thjtkon5x6h',NULL,NULL,1,0,'2026-01-14 07:45:28',4,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(5,1,'II','A','A5','II A5','short_answer',1,'questions/1768377590270-question-swjcq1llxlo','questions/1768377680444-answer-mwg1y5ci2t',NULL,NULL,1,0,'2026-01-14 07:45:28',5,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(6,1,'II','A','A6','II A6','short_answer',2,'questions/1768377590628-question-7xdcejm3j9h','questions/1768377733397-answer-6kwnrqb5tzt',NULL,NULL,1,0,'2026-01-14 07:45:28',6,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(7,1,'II','A','A7','II A7','short_answer',2,'questions/1768377590881-question-v04macjv7bl','questions/1768377827572-answer-n2axa8mrz7',NULL,NULL,1,0,'2026-01-14 07:45:28',7,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(8,1,'II','A','A8','II A8','short_answer',1,'questions/1768377591151-question-ltnlej0trem','questions/1768377827873-answer-1pn911mytg0i',NULL,NULL,1,0,'2026-01-14 07:45:28',8,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(9,1,'II','A','A9','II A9','short_answer',2,'questions/1768377591427-question-keumu30lbb8','questions/1768377828161-answer-scf8wetewh',NULL,NULL,1,0,'2026-01-14 07:45:28',9,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(10,1,'II','A','A10','II A10','short_answer',3,'questions/1768377591705-question-t0chtzzzuv','questions/1768377828442-answer-gwrxg5diqat',NULL,NULL,1,0,'2026-01-14 07:45:28',10,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(11,1,'II','B','B1','II B1','short_answer',3,'questions/1768537330770-question-50uz85p7hyc','questions/1768540790559-answer-8u2wx09buc5',NULL,NULL,1,0,'2026-01-14 07:45:28',11,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(12,1,'II','B','B2','II B2','short_answer',1,'questions/1768537331059-question-6dximj675bt','questions/1768540791141-answer-sdyihc3sku',NULL,NULL,1,0,'2026-01-14 07:45:28',12,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(13,1,'II','B','B3','II B3','short_answer',2,'questions/1768537331341-question-c29gftx3sb5','questions/1768540791722-answer-sh0rjt1kaii',NULL,NULL,1,0,'2026-01-14 07:45:28',13,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(14,1,'II','B','B4','II B4','short_answer',3,'questions/1768537331657-question-1ngbjf4v9v8','questions/1768540914319-answer-kmtxal0rmt',NULL,NULL,1,0,'2026-01-14 07:45:28',14,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(15,1,'II','B','B5','II B5','short_answer',3,'questions/1768537331926-question-o0zm0gt7nrc','questions/1768540914839-answer-31ub3en5ot3',NULL,NULL,1,0,'2026-01-14 07:45:28',15,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(16,1,'II','B','B6','II B6','short_answer',3,'questions/1768541078912-question-etan166b83a','questions/1768541079115-answer-nog3xws188',NULL,NULL,1,0,'2026-01-14 07:45:28',16,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(17,1,'II','C','C1','II C1','short_answer',2,'questions/1768539257093-question-4fyd4yq51zv','questions/1768541079380-answer-u7hbbk7pwe',NULL,NULL,1,0,'2026-01-14 07:45:28',17,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(18,1,'II','C','C2','II C2','short_answer',4,'questions/1768539257410-question-zg57gjx2jq','questions/1768541287977-answer-9pyg7iywmp6',NULL,NULL,1,0,'2026-01-14 07:45:28',18,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(19,1,'II','C','C3','II C3','short_answer',3,'questions/1768539257779-question-i8dmbw6o8fj','questions/1768541288347-answer-ypthzwo8t5k',NULL,NULL,1,0,'2026-01-14 07:45:28',19,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(20,1,'II','C','C4','II C4','short_answer',5,'questions/1768539258053-question-fkpz8q45hyt','questions/1768541288509-answer-drrnxwbj535',NULL,NULL,1,0,'2026-01-14 07:45:28',20,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(21,1,'II','C','C5','II C5','short_answer',4,'questions/1768539258335-question-6usxwpldos','questions/1768541288723-answer-bywptv2g77',NULL,NULL,1,0,'2026-01-14 07:45:28',21,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(22,1,'II','D','D1','II D1','short_answer',2,'questions/1768539352745-question-wohm5j38kx','questions/1768541657405-answer-nao86mxr88n',NULL,NULL,1,0,'2026-01-14 07:45:28',22,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(23,1,'II','D','D2','II D2','short_answer',3,'questions/1768539353009-question-h09j0hrywmw','questions/1768541657710-answer-lqp18krlc8b',NULL,NULL,1,0,'2026-01-14 07:45:28',23,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(24,1,'II','D','D3','II D3','short_answer',2,'questions/1768539353256-question-ihvqjog49bg','questions/1768541658046-answer-l1z52w83sl',NULL,NULL,1,0,'2026-01-14 07:45:28',24,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(25,1,'II','E','E1','II E1','short_answer',4,'questions/1768540572730-question-eloxfw9sx0j','questions/1768541892734-answer-55sf3y1b7n6','questions/1768540473703-stimulus-1wi44cgy2cw',NULL,1,0,'2026-01-14 07:45:28',25,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(26,1,'II','E','E2','II E2','short_answer',4,'questions/1768540573120-question-gnvhf95fdgu','questions/1768541893133-answer-ubvhpuqwfus',NULL,NULL,1,0,'2026-01-14 07:45:28',26,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(27,1,'II','E','E3','II E3','short_answer',4,'questions/1768540573549-question-a0ojeejbn1','questions/1768541893515-answer-o5prhayu0rl',NULL,NULL,1,0,'2026-01-14 07:45:28',27,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(28,1,'II','E','E4','II E4','short_answer',4,'questions/1768540573923-question-ofn7mxfvp4a','questions/1768541893849-answer-wdvf7ey02dg',NULL,NULL,1,0,'2026-01-14 07:45:28',28,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(29,1,'II','A','A11','II A11',NULL,NULL,NULL,NULL,NULL,NULL,1,1,'2026-01-16 04:42:14',10.5,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(30,1,'II','B','B7','II B7','short_answer',NULL,'questions/1768539256753-question-h2wcncrxqk9','questions/1768540915690-answer-t5y5iuf70fk',NULL,NULL,1,1,'2026-01-16 04:45:00',16.5,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(31,1,'II','C','C6','II C6','short_answer',NULL,NULL,NULL,NULL,NULL,1,1,'2026-01-16 04:47:04',21.5,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(32,1,'II','D','D4','II D4','short_answer',8,'questions/1768540571951-question-tt3tqrrw36o','questions/1768541658395-answer-xbuy2z3d59','questions/1768540572346-stimulus-cbulguaqxo4',NULL,1,0,'2026-01-16 05:13:46',24.5,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(79,2,'I','A','A1',NULL,'multiple_choice',1,NULL,NULL,NULL,'D',1,0,'2026-01-19 01:43:11',1,replace(replace('Which of the following markets would be involved for a wholesaler of confectionery who sells to retailers as well as individuals?\r\n\r\n(A) Resource and industrial\r\n\r\n(B) Niche and mass market\r\n\r\n(C) Industrial and intermediate\r\n\r\n(D) Intermediate and consumer','\r',char(13)),'\n',char(10)),'D',NULL);
INSERT INTO "exam_questions" VALUES(80,2,'I','A','A2',NULL,'multiple_choice',1,NULL,NULL,NULL,'A',1,0,'2026-01-19 01:43:11',2,replace(replace('Which of the following would a doctor likely use to differentiate from competitors?\r\n\r\n(A) Qualifications and experience\r\n\r\n(B) Cross branding and ownership\r\n\r\n(C) Value and augmented features\r\n\r\n(D) Augmented features and materials','\r',char(13)),'\n',char(10)),'A',NULL);
INSERT INTO "exam_questions" VALUES(81,2,'I','A','A3',NULL,'multiple_choice',1,NULL,NULL,NULL,'B',1,0,'2026-01-19 01:43:11',3,replace(replace('The NJ Store is a clothing retailer that is always finding it is short on stock.\r\n\r\nWhich of the following would be a way the business could best address these physical\r\n\r\ndistribution issues?\r\n\r\n(A) Utilise stocktaking regularly to check the total value of all stock\r\n\r\n(B) Undertake warehousing to ensure efficient delivery of the products\r\n\r\n(C) Bring in a scanning system to ensure that products are more secure\r\n\r\n(D) Use price skimming to ensure that inventory is less likely to run out','\r',char(13)),'\n',char(10)),'B',NULL);
INSERT INTO "exam_questions" VALUES(82,2,'I','A','A4',NULL,'multiple_choice',1,NULL,NULL,NULL,'A',1,0,'2026-01-19 01:43:11',4,replace(replace('Which of the following would be the biggest factors influencing the decision of a teenager to\r\n\r\npurchase the latest fashions in clothing?\r\n\r\n(A) Reference groups and motives\r\n\r\n(B) Personality and consumer laws\r\n\r\n(C) Family roles and economic activity\r\n\r\n(D) Regulations and learning experiences','\r',char(13)),'\n',char(10)),'A',NULL);
INSERT INTO "exam_questions" VALUES(83,2,'I','A','A5',NULL,'multiple_choice',1,NULL,NULL,NULL,'B',1,0,'2026-01-19 01:43:11',5,replace(replace('Which of the following pieces of legislation would be being breached if a woman was looked\r\n\r\nover for a promotion because she was pregnant?\r\n\r\n(A) Fair Work Act 2009\r\n\r\n(B) Sex Discrimination Act 1984\r\n\r\n(C) Affirmative Action Act 1986\r\n\r\n(D) Workplace Relations Act 1996','\r',char(13)),'\n',char(10)),'B',NULL);
INSERT INTO "exam_questions" VALUES(84,2,'I','A','A6',NULL,'multiple_choice',1,NULL,NULL,NULL,'D',1,0,'2026-01-19 01:43:12',6,replace(replace('Which of the following examples would be considered misleading and deceptive?\r\n\r\n(A) A retailer refuses to refund a TV that is faulty as they have a “No Refunds” sign\r\n\r\n(B) A plumber that usually charges $200 charges $350 knowing the urgency of the job\r\n\r\n(C) A seafood store states it is Tasmanian produce on display without having evidence\r\n\r\n(D) A weight loss pill states in fine print that their product will not be guaranteed to work','\r',char(13)),'\n',char(10)),'D',NULL);
INSERT INTO "exam_questions" VALUES(85,2,'I','A','A7',NULL,'multiple_choice',1,NULL,NULL,NULL,'B',1,0,'2026-01-19 01:43:12',7,replace(replace('A business manufacturing fruit juice uses pineapples from a local farm.\r\n\r\nWhich of the following would the pineapples be classified as?\r\n\r\n(A) Industrial resource\r\n\r\n(B) Transformed resource\r\n\r\n(C) Transforming resource\r\n\r\n(D) Transformation resource','\r',char(13)),'\n',char(10)),'B',NULL);
INSERT INTO "exam_questions" VALUES(86,2,'I','A','A8',NULL,'multiple_choice',1,NULL,NULL,NULL,'B',1,0,'2026-01-19 01:43:12',8,replace(replace('Harry’s Hoola Hoops have traditionally produced their products then used direct selling to\r\n\r\nencourage retailers to stock their goods for years. They have now decided to find out what the\r\n\r\nretailers want and tailor their product to the needs of their customer.\r\n\r\nWhich of the following statements about Harry’s Hoola Hoops is true?\r\n\r\n(A) The business has moved from a production approach to a selling approach\r\n\r\n(B) Their focus has recently shifted from a selling approach to a marketing approach\r\n\r\n(C) They originally used the marketing approach and now use the production approach\r\n\r\n(D) There has been a change of mindset from a quality approach to a marketing approach','\r',char(13)),'\n',char(10)),'B',NULL);
INSERT INTO "exam_questions" VALUES(87,2,'I','A','A9',NULL,'multiple_choice',1,NULL,NULL,NULL,'D',1,0,'2026-01-19 01:43:12',9,replace(replace('Which of the following involves monitoring the flow of materials to best meet the needs of\r\n\r\ncustomers?\r\n\r\n(A) Global sourcing\r\n\r\n(B) Critical path analysis\r\n\r\n(C) Value adding process\r\n\r\n(D) Supply chain management','\r',char(13)),'\n',char(10)),'D',NULL);
INSERT INTO "exam_questions" VALUES(88,2,'I','A','A10',NULL,'multiple_choice',1,NULL,NULL,NULL,'C',1,0,'2026-01-19 01:43:12',10,replace(replace('Sally finds that after paying a very high price for her android phone that was advertised as having\r\n\r\nthe latest technology incorporated with it that it does not stay on for more than 10 minutes at a\r\n\r\ntime.\r\n\r\nWhich of the following legal matters could Sally raise with the manufacturer that have been\r\n\r\nbreached?\r\n\r\n(A) Materialism\r\n\r\n(B) Puffery claims\r\n\r\n(C) Implied conditions\r\n\r\n(D) Dishonest advertising','\r',char(13)),'\n',char(10)),'C',NULL);
INSERT INTO "exam_questions" VALUES(89,2,'I','A','A11',NULL,'multiple_choice',1,NULL,NULL,NULL,'C',1,0,'2026-01-19 01:43:12',11,replace(replace('Which of the following would NOT be considered ethical issues in marketing products?\r\n\r\n(A) Creation of needs\r\n\r\n(B) Product placement\r\n\r\n(C) Product warranties\r\n\r\n(D) Gender stereotyping','\r',char(13)),'\n',char(10)),'C',NULL);
INSERT INTO "exam_questions" VALUES(90,2,'I','A','A12',NULL,'multiple_choice',1,NULL,NULL,NULL,'D',1,0,'2026-01-19 01:43:12',12,replace(replace('A pizza deliver service needs to ensure that its product is produced and delivered in a timely and\r\n\r\nreliable manner where the pizza is hot and of a high quality.\r\n\r\nWhich of the following elements of services marketing are they focusing on?\r\n\r\n(A) People and product\r\n\r\n(B) Processes and people\r\n\r\n(C) Place and physical evidence\r\n\r\n(D) Physical evidence and processes','\r',char(13)),'\n',char(10)),'D',NULL);
INSERT INTO "exam_questions" VALUES(91,2,'I','A','A13',NULL,'multiple_choice',1,NULL,NULL,NULL,'C',1,0,'2026-01-19 01:43:12',13,replace(replace('A business is aiming to reduce its total level of debts so that they can remain a viable proposition\r\n\r\nin the long term.\r\n\r\nWhich of the following objectives of financial management are they currently trying to address?\r\n\r\n(A) Growth\r\n\r\n(B) Liquidity\r\n\r\n(C) Solvency\r\n\r\n(D) Profitability','\r',char(13)),'\n',char(10)),'C',NULL);
INSERT INTO "exam_questions" VALUES(92,2,'I','A','A14',NULL,'multiple_choice',1,NULL,NULL,NULL,'A',1,0,'2026-01-19 01:43:12',14,replace(replace('Which of the following statements about recruitment is true?\r\n\r\n(A) Internal recruitment is cheaper to use and can demotivate other staff\r\n\r\n(B) External recruitment is more expensive to use and can motivate staff\r\n\r\n(C) External recruitment is cheaper to use and can provide more qualified staff\r\n\r\n(D) Internal recruitment is more expensive to use and can provide more qualified staff','\r',char(13)),'\n',char(10)),'A',NULL);
INSERT INTO "exam_questions" VALUES(93,2,'I','A','A15',NULL,'multiple_choice',1,NULL,NULL,NULL,'C',1,0,'2026-01-19 01:43:12',15,replace(replace('Which of the following would be the most useful strategies for a business hoping to position the\r\n\r\nproduct as very high quality?\r\n\r\n(A) Direct selling and product packaging\r\n\r\n(B) Selective distribution and e-marketing\r\n\r\n(C) Product branding and exclusive distribution\r\n\r\n(D) Intensive distribution and penetration pricing','\r',char(13)),'\n',char(10)),'C',NULL);
INSERT INTO "exam_questions" VALUES(94,2,'I','A','A16',NULL,'multiple_choice',1,NULL,NULL,NULL,'A',1,0,'2026-01-19 01:43:12',16,replace(replace('A global fast food business that is well established has a powerful brand image and wants to\r\n\r\nexpand into a new market in South East Asia with limited existing fast food outlets would be\r\n\r\nmost focused on what in the initial stages of expansion?\r\n\r\n(A) Global pricing and standardisation\r\n\r\n(B) Standardisation and transfer pricing\r\n\r\n(C) Competitive positioning and global pricing\r\n\r\n(D) Customisation and competitive positioning\r\n\r\n**Questions 17 and 18 use the following information on BRKs as at 30/06/13:**','\r',char(13)),'\n',char(10)),'A',NULL);
INSERT INTO "exam_questions" VALUES(95,2,'I','A','A17',NULL,'multiple_choice',1,NULL,NULL,'questions/1768793072287-stimulus-fjhjgdlws0e','B',1,0,'2026-01-19 01:43:12',17,replace(replace('What is the current ratio for BRKs on the above date?\r\n\r\n(A) 0.09:1\r\n\r\n(B) 0.53:1\r\n\r\n(C) 0.69:1\r\n\r\n(D) 1.89:1','\r',char(13)),'\n',char(10)),'B',NULL);
INSERT INTO "exam_questions" VALUES(96,2,'I','A','A18',NULL,'multiple_choice',1,NULL,NULL,'questions/1768793072517-stimulus-iky4450knxj','B',1,0,'2026-01-19 01:43:12',18,replace(replace('Which of the following strategies would be most useful for BRKs to improve its liquidity?\r\n\r\n(A) Factoring\r\n\r\n(B) Sale and lease back\r\n\r\n(C) Distribution of payments\r\n\r\n(D) Discounts for early payment','\r',char(13)),'\n',char(10)),'B',NULL);
INSERT INTO "exam_questions" VALUES(97,2,'I','A','A19',NULL,'multiple_choice',1,NULL,NULL,NULL,'A',1,0,'2026-01-19 01:43:12',19,replace(replace('Which of the following forms of promotion would be most appropriate for a business that has a\r\n\r\nvisually appealing product that hopes to reach a mass market?\r\n\r\n(A) Billboard ads\r\n\r\n(B) Public relations\r\n\r\n(C) Direct marketing\r\n\r\n(D) Relationship marketing','\r',char(13)),'\n',char(10)),'A',NULL);
INSERT INTO "exam_questions" VALUES(98,2,'I','A','A20',NULL,'multiple_choice',1,NULL,NULL,NULL,'C',1,0,'2026-01-19 01:43:12',20,replace(replace('Which of the following gives the buyer the right but not the obligation to buy currency at a\r\n\r\nspecified time in the future?\r\n\r\n(A) A swap contract\r\n\r\n(B) A futures contract\r\n\r\n(C) An options contract\r\n\r\n(D) A derivative contract','\r',char(13)),'\n',char(10)),'C',NULL);
INSERT INTO "exam_questions" VALUES(99,2,'II','B','B1',NULL,'short_answer',2,NULL,'questions/1768793382607-answer-0812na917b1','questions/1768793346951-stimulus-z7dvlwah9xi',NULL,1,0,'2026-01-19 01:43:12',21,'(a) Identify TWO factors that distinguish casual workers from part-time workers',NULL,NULL);
INSERT INTO "exam_questions" VALUES(100,2,'II','B','B2',NULL,'short_answer',4,NULL,'questions/1768793347243-answer-gesidrifm0e',NULL,NULL,1,0,'2026-01-19 01:43:12',22,'(b) Compare and contrast the use of collective agreements with common law contracts.',NULL,NULL);
INSERT INTO "exam_questions" VALUES(101,2,'II','B','B3',NULL,'short_answer',4,NULL,'questions/1768793347431-answer-u12wrmua1b',NULL,NULL,1,0,'2026-01-19 01:43:12',23,'(c) Explain how performance management could be used to benefit both the employee and the employer.',NULL,NULL);
INSERT INTO "exam_questions" VALUES(102,2,'II','C','C1',NULL,'short_answer',2,NULL,'questions/1768793347614-answer-c2jvsed1uas',NULL,NULL,1,0,'2026-01-19 01:43:12',24,'(a) Identify ONE primary and ONE secondary form of market research that _Pescado del Dia_ could use to improve the potential for their global expansion',NULL,replace(replace('Pescado del Dia is a pet store specialising in fish and aquariums that has been operating in six\r\nmajor cities across Australia for 15 years. They are looking to expand into Asia in the future and\r\nneed some help investigating how they could do so successfully.','\r',char(13)),'\n',char(10)));
INSERT INTO "exam_questions" VALUES(103,2,'II','C','C2',NULL,'short_answer',4,NULL,'questions/1768793347798-answer-s1kv6qaz2lp',NULL,NULL,1,0,'2026-01-19 01:43:12',25,'(b) Propose and justify TWO factors that _Pescado del Dia_ would need to consider for their product when expanding into Asia',NULL,replace(replace('Pescado del Dia is a pet store specialising in fish and aquariums that has been operating in six\r\nmajor cities across Australia for 15 years. They are looking to expand into Asia in the future and\r\nneed some help investigating how they could do so successfully.','\r',char(13)),'\n',char(10)));
INSERT INTO "exam_questions" VALUES(104,2,'II','C','C3',NULL,'short_answer',4,NULL,'questions/1768793347998-answer-gdoqymb3f2v',NULL,NULL,1,0,'2026-01-19 01:43:12',26,'10(c) Evaluate the potential for E-marketing to be used by _Pescado del Dia_ with their new ideas',NULL,replace(replace('Pescado del Dia is a pet store specialising in fish and aquariums that has been operating in six\r\nmajor cities across Australia for 15 years. They are looking to expand into Asia in the future and\r\nneed some help investigating how they could do so successfully.','\r',char(13)),'\n',char(10)));
INSERT INTO "exam_questions" VALUES(105,2,'II','D','D1',NULL,'short_answer',4,NULL,'questions/1768793348193-answer-0grauifc2im9',NULL,NULL,1,0,'2026-01-19 01:43:12',27,'(a) Complete a simple SWOT analysis for _Fashionista_ in the space below',NULL,replace(replace('Fashionista is a proposed fashion magazine on the latest glamorous trends and upcoming product\r\nlaunches which is in the planning stages prior to their first release into a highly saturated market.','\r',char(13)),'\n',char(10)));
INSERT INTO "exam_questions" VALUES(106,2,'II','D','D2',NULL,'short_answer',3,NULL,'questions/1768793348347-answer-3i5dvupj07l',NULL,NULL,1,0,'2026-01-19 01:43:13',28,'(b) Propose and justify a primary target market for _Fashionista_',NULL,replace(replace('Fashionista is a proposed fashion magazine on the latest glamorous trends and upcoming product\r\nlaunches which is in the planning stages prior to their first release into a highly saturated market.','\r',char(13)),'\n',char(10)));
INSERT INTO "exam_questions" VALUES(107,2,'II','D','D3',NULL,'short_answer',3,NULL,'questions/1768793348544-answer-akwm45z51v5',NULL,NULL,1,0,'2026-01-19 01:43:13',29,'(c) Recommend and justify ONE pricing strategy that could be used for _Fashionista_',NULL,replace(replace('Fashionista is a proposed fashion magazine on the latest glamorous trends and upcoming product\r\nlaunches which is in the planning stages prior to their first release into a highly saturated market.','\r',char(13)),'\n',char(10)));
INSERT INTO "exam_questions" VALUES(108,2,'II','E','E1',NULL,'short_answer',2,NULL,'questions/1768793348702-answer-lrcyholdptl','questions/1768793073017-stimulus-vypnv9px7j',NULL,1,0,'2026-01-19 01:43:13',30,'(a) What is the purpose of a cash flow statement for a business?',NULL,NULL);
INSERT INTO "exam_questions" VALUES(109,2,'II','E','E2',NULL,'short_answer',2,NULL,'questions/1768793348874-answer-u3lw1nq187','questions/1768793073220-stimulus-lfzylw2j1li',NULL,1,0,'2026-01-19 01:43:13',31,'13(b) Calculate the closing cash balance for XYZ Ltd.',NULL,NULL);
INSERT INTO "exam_questions" VALUES(110,2,'II','E','E3',NULL,'short_answer',3,NULL,'questions/1768793349050-answer-0zn695muwodr','questions/1768793073464-stimulus-jtgd2ikzw0m',NULL,1,0,'2026-01-19 01:43:13',32,'(c) Assess the cash flow of XYZ Ltd for the quarter using the cash flow statement above.',NULL,NULL);
INSERT INTO "exam_questions" VALUES(111,2,'II','E','E4',NULL,'short_answer',3,NULL,'questions/1768793349252-answer-75958f1kd6e','questions/1768793073658-stimulus-cj7ceznhk0o',NULL,1,0,'2026-01-19 01:43:13',33,'(d) Recommend ONE action would you make to XYZ Ltd to help them improve their cash flow',NULL,NULL);
INSERT INTO "exam_questions" VALUES(112,2,'III','E','E1',NULL,'extended_response',20,NULL,'questions/1768793349449-answer-y7mf8pyyc9','questions/1768793073887-stimulus-hzbbufwg4zk',NULL,1,0,'2026-01-19 01:43:13',34,'Examine the processes of HRM that management could address and strategies the business could use to improve profitability.',NULL,NULL);
INSERT INTO "exam_questions" VALUES(113,2,'IV','E','E1',NULL,'extended_response',20,NULL,'questions/1768793349617-answer-maosc4wevz',NULL,NULL,1,0,'2026-01-19 01:43:13',35,'How can quality management help a business achieve its performance objectives?',NULL,NULL);
INSERT INTO "exam_questions" VALUES(114,2,'IV','E','E2',NULL,'extended_response',20,NULL,'questions/1768793349859-answer-vrxxw3lbank',NULL,NULL,1,0,'2026-01-19 01:43:13',36,'How can market segmentation help a business achieve its marketing objectives?',NULL,NULL);
INSERT INTO "exam_questions" VALUES(115,3,'II','A1','A11','II A11','short_answer',2,'questions/1768792641124-question-95493pu3d7i','questions/1768794104786-answer-8w6d95q8orm',NULL,NULL,17,0,'2026-01-19 03:14:28',1,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(116,3,'II','A1','A12','II A12','short_answer',2,'questions/1768792708858-question-noro39zvex9','questions/1768794105036-answer-pwf7wbihqu',NULL,NULL,17,0,'2026-01-19 03:14:28',2,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(117,3,'II','A1','A13','II A13','short_answer',1,'questions/1768792760343-question-0fsbcwowozej','questions/1768794105299-answer-ccoe4g0rkft',NULL,NULL,17,0,'2026-01-19 03:14:28',3,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(118,3,'II','A1','A14','II A14','short_answer',4,'questions/1768792840736-question-4p5b3tqo24m','questions/1768794105554-answer-o7odzurid9',NULL,NULL,17,0,'2026-01-19 03:14:28',4,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(119,3,'II','A1','A15','II A15','short_answer',2,'questions/1768792894708-question-yqfgasx2fq','questions/1768794105791-answer-nxqfa9fgrnl',NULL,NULL,17,0,'2026-01-19 03:14:28',5,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(120,3,'II','A1','A16','II A16','short_answer',1,'questions/1768792968252-question-12njv5pbib3','questions/1768794106008-answer-rzx0ovitzu9',NULL,NULL,17,0,'2026-01-19 03:14:28',6,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(121,3,'II','A2','A21','II A21','short_answer',2,'questions/1768793375025-question-fbj835564pw','questions/1768794106273-answer-yjgy9da7c78',NULL,NULL,17,0,'2026-01-19 03:14:28',7,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(122,3,'II','A2','A22','II A22','short_answer',2,'questions/1768793375372-question-q41ls13jn6','questions/1768794106538-answer-0in3wr51zp',NULL,NULL,17,0,'2026-01-19 03:14:28',8,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(123,3,'II','A2','A23','II A23','short_answer',9,'questions/1768793375700-question-ju5srbw3kg','questions/1768794106808-answer-c8s0168on1',NULL,NULL,17,0,'2026-01-19 03:14:28',9,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(124,3,'II','A3','A31','II A31','short_answer',6,'questions/1768793487792-question-xbkcv38n83s','questions/1768794107120-answer-ydglydrlpq',NULL,NULL,17,0,'2026-01-19 03:14:28',10,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(125,3,'II','A3','A32','II A32','short_answer',2,'questions/1768793488172-question-fj4q6y7bbs9','questions/1768794107383-answer-0o8hj5fxe3qi',NULL,NULL,17,0,'2026-01-19 03:14:28',11,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(126,3,'II','A3','A33','II A33','short_answer',2,'questions/1768793488492-question-r6t2hzzocar','questions/1768794107658-answer-4per00nb5ua',NULL,NULL,17,0,'2026-01-19 03:14:28',12,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(127,3,'II','A3','A34','II A34','short_answer',3,'questions/1768793488840-question-8uq52qyaby','questions/1768794107955-answer-5dnxw5iplpj',NULL,NULL,17,0,'2026-01-19 03:14:28',13,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(128,3,'II','A4','A41','II A41','short_answer',6,'questions/1768793647947-question-sm13ltr6wmb','questions/1768794108258-answer-vpwc7w21nga',NULL,NULL,17,0,'2026-01-19 03:14:28',14,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(129,3,'II','A4','A42','II A42','short_answer',6,'questions/1768793648311-question-t98qd64hlip','questions/1768794108491-answer-nqn5f1wnf2',NULL,NULL,17,0,'2026-01-19 03:14:28',15,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(130,3,'II','A5','A51','II A51','short_answer',4,'questions/1768793648720-question-5hmal6zslde','questions/1768794108735-answer-cki2ivhstst',NULL,NULL,17,0,'2026-01-19 03:14:28',16,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(131,3,'II','A5','A52','II A52','short_answer',3,'questions/1768793649118-question-k44dxbp79q','questions/1768794108974-answer-afv833euqj',NULL,NULL,17,0,'2026-01-19 03:14:28',17,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(132,3,'II','A5','A53','II A53','short_answer',6,'questions/1768793649448-question-t1w5qon4oxk','questions/1768794109188-answer-d9x9lu1cowv',NULL,NULL,17,0,'2026-01-19 03:14:28',18,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(133,3,'II','A6','A61','II A61','short_answer',2,'questions/1768793743264-question-sqdqoy9vt3','questions/1768794109439-answer-944e1gim1o6',NULL,NULL,17,0,'2026-01-19 03:14:28',19,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(134,3,'II','A6','A62','II A62','short_answer',2,'questions/1768793743635-question-vpo5xvsgri','questions/1768794109726-answer-fp4kjvnam1e',NULL,NULL,17,0,'2026-01-19 03:14:28',20,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(135,3,'II','A6','A63','II A63','short_answer',4,'questions/1768793743936-question-8x2fc06p3s2','questions/1768794110011-answer-3u3g49blmal',NULL,NULL,17,0,'2026-01-19 03:14:28',21,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(136,3,'II','A6','A64','II A64','short_answer',4,'questions/1768793744254-question-ae4olbhq4bi','questions/1768794110233-answer-bf3es5fh7db',NULL,NULL,17,0,'2026-01-19 03:14:28',22,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(137,3,'II','A1','A17','II A17','short_answer',NULL,NULL,NULL,NULL,NULL,17,1,'2026-01-19 03:17:22',6.5,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(138,3,'II','A1','A18','II A18','short_answer',NULL,NULL,NULL,NULL,NULL,17,1,'2026-01-19 03:18:29',6.75,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(139,3,'II','A1','A19','II A19','short_answer',NULL,NULL,NULL,NULL,NULL,17,1,'2026-01-19 03:19:20',6.875,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(140,3,'II','A1','A20','II A20','short_answer',NULL,NULL,NULL,NULL,NULL,17,1,'2026-01-19 03:19:28',6.9375,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(141,3,'II','A1','A21','II A21','short_answer',NULL,NULL,NULL,NULL,NULL,17,1,'2026-01-19 03:21:35',6.96875,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(142,4,'I','A','A1','I A1','multiple_choice',1,'questions/1768813962698-question-4ia8lhvamww',NULL,NULL,'A',17,0,'2026-01-19 09:08:09',1,NULL,replace(replace('B\r\n','\r',char(13)),'\n',char(10)),NULL);
INSERT INTO "exam_questions" VALUES(143,4,'I','A','A2','I A2','multiple_choice',1,'questions/1768817526424-question-d1zh8jb2nc',NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',2,NULL,'C',NULL);
INSERT INTO "exam_questions" VALUES(144,4,'I','A','A3','I A3','multiple_choice',1,'questions/1768817526751-question-6t7c7mxht7q',NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',3,NULL,'B',NULL);
INSERT INTO "exam_questions" VALUES(145,4,'I','A','A4','I A4','multiple_choice',1,'questions/1768817527106-question-g2ackqll1wl',NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',4,NULL,'B',NULL);
INSERT INTO "exam_questions" VALUES(146,4,'I','A','A5','I A5','multiple_choice',1,'questions/1768817527406-question-zbdr9n2mgs',NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',5,NULL,'D',NULL);
INSERT INTO "exam_questions" VALUES(147,4,'I','A','A6','I A6','multiple_choice',1,'questions/1768817527739-question-zrziswftdx',NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',6,NULL,'D',NULL);
INSERT INTO "exam_questions" VALUES(148,4,'I','A','A7','I A7','multiple_choice',1,'questions/1768817528111-question-jqzbcv32aa8',NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',7,NULL,'C',NULL);
INSERT INTO "exam_questions" VALUES(149,4,'I','A','A8','I A8','multiple_choice',1,'questions/1768817528411-question-uheqob8avhp',NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',8,NULL,'A',NULL);
INSERT INTO "exam_questions" VALUES(150,4,'I','A','A9','I A9','multiple_choice',1,'questions/1768817528761-question-vcikx0rjeko',NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',9,NULL,'B',NULL);
INSERT INTO "exam_questions" VALUES(151,4,'I','A','A10','I A10','multiple_choice',1,'questions/1768817529097-question-avz4gdcuido',NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',10,NULL,'C',NULL);
INSERT INTO "exam_questions" VALUES(152,4,'II','A','A1','II A1','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',11,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(153,4,'II','A','A2','II A2','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',12,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(154,4,'II','A','A3','II A3','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',13,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(155,4,'II','A','A4','II A4','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',14,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(156,4,'II','B','B1','II B1','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',15,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(157,4,'II','B','B2','II B2','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',16,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(158,4,'II','B','B3','II B3','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',17,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(159,4,'II','B','B4','II B4','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',18,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(160,4,'II','C','C1','II C1','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',19,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(161,4,'II','C','C2','II C2','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',20,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(162,4,'II','C','C3','II C3','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',21,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(163,4,'II','C','C4','II C4','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',22,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(164,4,'II','C','C5','II C5','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',23,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(165,4,'II','C','C6','II C6','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',24,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(166,4,'II','D','D1','II D1','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',25,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(167,4,'II','D','D2','II D2','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',26,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(168,4,'II','D','D3','II D3','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',27,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(169,4,'II','E','E1','II E1','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',28,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(170,4,'II','E','E2','II E2','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',29,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(171,4,'II','E','E3','II E3','short_answer',NULL,NULL,NULL,NULL,NULL,17,0,'2026-01-19 09:08:09',30,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(172,5,'I','A','A1','I A1',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',1,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(173,5,'I','A','A2','I A2',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',2,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(174,5,'I','A','A3','I A3',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',3,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(175,5,'I','A','A4','I A4',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',4,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(176,5,'I','A','A5','I A5',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',5,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(177,5,'I','A','A6','I A6',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',6,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(178,5,'I','A','A7','I A7',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',7,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(179,5,'I','A','A8','I A8',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',8,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(180,5,'I','A','A9','I A9',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',9,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(181,5,'I','A','A10','I A10',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',10,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(182,5,'I','A','A11','I A11',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',11,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(183,5,'I','A','A12','I A12',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',12,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(184,5,'I','A','A13','I A13',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',13,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(185,5,'I','A','A14','I A14',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',14,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(186,5,'I','A','A15','I A15',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',15,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(187,5,'I','A','A16','I A16',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',16,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(188,5,'I','A','A17','I A17',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',17,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(189,5,'I','A','A18','I A18',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',18,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(190,5,'I','A','A19','I A19',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',19,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(191,5,'I','A','A20','I A20',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',20,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(192,5,'II','B','B1','II B1',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',21,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(193,5,'II','B','B2','II B2',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',22,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(194,5,'II','B','B3','II B3',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',23,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(195,5,'II','B','B4','II B4',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',24,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(196,5,'II','B','B5','II B5',NULL,NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:55:21',25,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(197,6,'I','A','A1','I A1','multiple_choice',1,'questions/1770109297137-question-2w0whw35ste',NULL,NULL,'A',9,0,'2026-02-03 08:56:04',1,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(198,6,'I','A','A2','I A2','multiple_choice',NULL,'questions/1770109859273-question-7esplzzwmzo',NULL,NULL,'C',9,0,'2026-02-03 08:56:04',2,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(199,6,'I','A','A3','I A3','multiple_choice',NULL,'questions/1770109859599-question-u9eekkqkuwg',NULL,NULL,'C',9,0,'2026-02-03 08:56:04',3,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(200,6,'I','A','A4','I A4','multiple_choice',NULL,'questions/1770109859934-question-m6zpwy8md6g',NULL,NULL,'C',9,0,'2026-02-03 08:56:04',4,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(201,6,'I','A','A5','I A5','multiple_choice',NULL,'questions/1770109860126-question-kv3o00rl8g',NULL,NULL,'C',9,0,'2026-02-03 08:56:04',5,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(202,6,'I','A','A6','I A6','multiple_choice',NULL,'questions/1770109860322-question-l0j5kj55vgr',NULL,NULL,'C',9,0,'2026-02-03 08:56:04',6,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(203,6,'I','A','A7','I A7','multiple_choice',NULL,'questions/1770109860572-question-vkilr3t48p',NULL,NULL,'C',9,0,'2026-02-03 08:56:04',7,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(204,6,'I','A','A8','I A8','multiple_choice',NULL,'questions/1770109860749-question-7sy4ootpbz9',NULL,NULL,'A',9,0,'2026-02-03 08:56:04',8,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(205,6,'I','A','A9','I A9','multiple_choice',NULL,'questions/1770109861003-question-out56szvk3i',NULL,NULL,'A',9,0,'2026-02-03 08:56:04',9,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(206,6,'I','A','A10','I A10','multiple_choice',NULL,'questions/1770109861216-question-77oiigi3m1n',NULL,NULL,'D',9,0,'2026-02-03 08:56:04',10,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(207,6,'I','A','A11','I A11','multiple_choice',NULL,'questions/1770109861425-question-hzssi53lm3k',NULL,NULL,'B',9,0,'2026-02-03 08:56:04',11,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(208,6,'I','A','A12','I A12','multiple_choice',NULL,'questions/1770109861647-question-akgzqxbfvnb',NULL,NULL,'D',9,0,'2026-02-03 08:56:04',12,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(209,6,'I','A','A13','I A13','multiple_choice',NULL,'questions/1770109861835-question-unycjjcz18r',NULL,NULL,'C',9,0,'2026-02-03 08:56:04',13,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(210,6,'I','A','A14','I A14','multiple_choice',NULL,'questions/1770109862033-question-8zslm0a3z43',NULL,NULL,'B',9,0,'2026-02-03 08:56:04',14,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(211,6,'I','A','A15','I A15','multiple_choice',NULL,'questions/1770109862276-question-sdxxivl0bvn',NULL,NULL,'B',9,0,'2026-02-03 08:56:04',15,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(212,6,'I','A','A16','I A16','multiple_choice',NULL,'questions/1770109862457-question-mzfjjukhss',NULL,NULL,'B',9,0,'2026-02-03 08:56:04',16,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(213,6,'I','A','A17','I A17','multiple_choice',NULL,'questions/1770109862682-question-fvsvaswlw0s',NULL,NULL,'C',9,0,'2026-02-03 08:56:04',17,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(214,6,'I','A','A18','I A18','multiple_choice',NULL,'questions/1770109862859-question-7c6vfyrjti5',NULL,NULL,'C',9,0,'2026-02-03 08:56:04',18,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(215,6,'I','A','A19','I A19','multiple_choice',NULL,'questions/1770109863040-question-akcb9gxz9sh',NULL,NULL,'A',9,0,'2026-02-03 08:56:04',19,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(216,6,'I','A','A20','I A20','multiple_choice',NULL,'questions/1770109863298-question-jhpsg2r63q',NULL,NULL,'D',9,0,'2026-02-03 08:56:04',20,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(217,6,'II','B','B1','II B1','short_answer',10,'questions/1770110737091-question-g9yhcsgde0n','questions/1770110737279-answer-vpvp8pup27','questions/1770110737452-stimulus-adqkokhvcka',NULL,9,0,'2026-02-03 08:56:04',21,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(218,6,'II','B','B2','II B2','short_answer',NULL,'questions/1770110737666-question-m2fe6qitd9a',NULL,NULL,NULL,9,0,'2026-02-03 08:56:04',22,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(219,6,'II','B','B3','II B3','short_answer',NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:56:04',23,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(220,6,'II','B','B4','II B4','short_answer',NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:56:04',24,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(221,6,'II','B','B5','II B5','short_answer',NULL,NULL,NULL,NULL,NULL,9,0,'2026-02-03 08:56:04',25,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(222,6,'I','A','A21','I A21','short_answer',NULL,NULL,NULL,NULL,NULL,9,1,'2026-02-03 08:59:55',20.5,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(223,7,'I','A','A1','I A1','multiple_choice',1,'questions/1770111285331-question-e1e0ai3uk8k',NULL,NULL,'C',5,0,'2026-02-03 09:20:44',1,NULL,'C',NULL);
INSERT INTO "exam_questions" VALUES(224,7,'I','A','A2','I A2','multiple_choice',1,'questions/1770111259027-question-zjdykd42uh',NULL,NULL,'D',5,0,'2026-02-03 09:20:44',2,NULL,'D',NULL);
INSERT INTO "exam_questions" VALUES(225,7,'I','A','A3','I A3','multiple_choice',1,'questions/1770111259206-question-8e4u9v9fl78',NULL,NULL,'B',5,0,'2026-02-03 09:20:44',3,NULL,'B',NULL);
INSERT INTO "exam_questions" VALUES(226,7,'I','A','A4','I A4','multiple_choice',1,'questions/1770112244117-question-3gj8llof7o8',NULL,NULL,'B',5,0,'2026-02-03 09:20:44',4,NULL,'B',NULL);
INSERT INTO "exam_questions" VALUES(227,7,'I','A','A5','I A5','multiple_choice',1,'questions/1770111259550-question-7hv0hxxx3f7',NULL,NULL,'C',5,0,'2026-02-03 09:20:44',5,NULL,'C',NULL);
INSERT INTO "exam_questions" VALUES(228,7,'I','A','A6','I A6','multiple_choice',1,'questions/1770111259710-question-0f8vcnbrz7aj',NULL,NULL,'B',5,0,'2026-02-03 09:20:44',6,NULL,'B',NULL);
INSERT INTO "exam_questions" VALUES(229,7,'I','A','A7','I A7','multiple_choice',1,'questions/1770111259964-question-5dj6m5rnar',NULL,NULL,'B',5,0,'2026-02-03 09:20:44',7,NULL,'B',NULL);
INSERT INTO "exam_questions" VALUES(230,7,'I','A','A8','I A8','multiple_choice',1,'questions/1770111260137-question-kb9dzqpvf2',NULL,NULL,'C',5,0,'2026-02-03 09:20:44',8,NULL,'C',NULL);
INSERT INTO "exam_questions" VALUES(231,7,'I','A','A9','I A9','multiple_choice',1,'questions/1770111260294-question-k28r4442gs',NULL,NULL,'A',5,0,'2026-02-03 09:20:44',9,NULL,'A',NULL);
INSERT INTO "exam_questions" VALUES(232,7,'I','A','A10','I A10','multiple_choice',1,'questions/1770111260449-question-74ee56a6qc3',NULL,NULL,'A',5,0,'2026-02-03 09:20:44',10,NULL,'A',NULL);
INSERT INTO "exam_questions" VALUES(233,7,'II','B','B1','II B1','short_answer',NULL,NULL,NULL,NULL,NULL,5,0,'2026-02-03 09:20:44',11,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(234,7,'II','B','B2','II B2','short_answer',NULL,NULL,NULL,NULL,NULL,5,0,'2026-02-03 09:20:44',12,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(235,7,'II','B','B3','II B3','short_answer',NULL,NULL,NULL,NULL,NULL,5,0,'2026-02-03 09:20:44',13,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(236,7,'II','B','B4','II B4','short_answer',NULL,NULL,NULL,NULL,NULL,5,0,'2026-02-03 09:20:44',14,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(237,7,'II','B','B5','II B5','short_answer',NULL,NULL,NULL,NULL,NULL,5,0,'2026-02-03 09:20:44',15,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(238,7,'II','B','B6','II B6','short_answer',NULL,NULL,NULL,NULL,NULL,5,0,'2026-02-03 09:20:44',16,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(239,8,'I','A','A1','I A1',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',1,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(240,8,'I','A','A2','I A2',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',2,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(241,8,'I','A','A3','I A3',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',3,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(242,8,'I','A','A4','I A4',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',4,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(243,8,'I','A','A5','I A5',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',5,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(244,8,'I','A','A6','I A6',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',6,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(245,8,'I','A','A7','I A7',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',7,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(246,8,'I','A','A8','I A8',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',8,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(247,8,'I','A','A9','I A9',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',9,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(248,8,'I','A','A10','I A10',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',10,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(249,8,'I','A','A11','I A11',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',11,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(250,8,'I','A','A12','I A12',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',12,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(251,8,'I','A','A13','I A13',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',13,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(252,8,'I','A','A14','I A14',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',14,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(253,8,'I','A','A15','I A15',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',15,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(254,8,'I','A','A16','I A16',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',16,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(255,8,'I','A','A17','I A17',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',17,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(256,8,'I','A','A18','I A18',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',18,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(257,8,'I','A','A19','I A19',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',19,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(258,8,'I','A','A20','I A20',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',20,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(259,8,'II','B','B1','II B1',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',21,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(260,8,'II','B','B2','II B2',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',22,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(261,8,'II','B','B3','II B3',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',23,NULL,NULL,NULL);
INSERT INTO "exam_questions" VALUES(262,8,'III','C','C1','III C1',NULL,NULL,NULL,NULL,NULL,NULL,20,0,'2026-02-03 09:34:29',24,NULL,NULL,NULL);
CREATE TABLE question_topics (
    question_id INTEGER NOT NULL,
    topic_id INTEGER NOT NULL,
    PRIMARY KEY (question_id, topic_id),
    FOREIGN KEY (question_id) REFERENCES exam_questions(id),
    FOREIGN KEY (topic_id) REFERENCES topics(id)
);
INSERT INTO "question_topics" VALUES(1,4);
INSERT INTO "question_topics" VALUES(2,2);
INSERT INTO "question_topics" VALUES(3,2);
INSERT INTO "question_topics" VALUES(4,5);
INSERT INTO "question_topics" VALUES(5,2);
INSERT INTO "question_topics" VALUES(7,7);
INSERT INTO "question_topics" VALUES(8,7);
INSERT INTO "question_topics" VALUES(9,8);
INSERT INTO "question_topics" VALUES(10,6);
INSERT INTO "question_topics" VALUES(11,6);
INSERT INTO "question_topics" VALUES(12,6);
INSERT INTO "question_topics" VALUES(13,4);
INSERT INTO "question_topics" VALUES(14,6);
INSERT INTO "question_topics" VALUES(15,8);
INSERT INTO "question_topics" VALUES(16,4);
INSERT INTO "question_topics" VALUES(17,6);
INSERT INTO "question_topics" VALUES(18,8);
INSERT INTO "question_topics" VALUES(19,12);
INSERT INTO "question_topics" VALUES(20,4);
INSERT INTO "question_topics" VALUES(21,8);
INSERT INTO "question_topics" VALUES(22,2);
INSERT INTO "question_topics" VALUES(23,6);
INSERT INTO "question_topics" VALUES(24,7);
INSERT INTO "question_topics" VALUES(32,6);
INSERT INTO "question_topics" VALUES(6,13);
INSERT INTO "question_topics" VALUES(25,13);
INSERT INTO "question_topics" VALUES(26,6);
INSERT INTO "question_topics" VALUES(27,8);
INSERT INTO "question_topics" VALUES(28,11);
INSERT INTO "question_topics" VALUES(79,16);
INSERT INTO "question_topics" VALUES(80,16);
INSERT INTO "question_topics" VALUES(81,16);
INSERT INTO "question_topics" VALUES(82,16);
INSERT INTO "question_topics" VALUES(83,17);
INSERT INTO "question_topics" VALUES(84,16);
INSERT INTO "question_topics" VALUES(85,14);
INSERT INTO "question_topics" VALUES(86,16);
INSERT INTO "question_topics" VALUES(87,14);
INSERT INTO "question_topics" VALUES(88,16);
INSERT INTO "question_topics" VALUES(89,16);
INSERT INTO "question_topics" VALUES(90,16);
INSERT INTO "question_topics" VALUES(91,15);
INSERT INTO "question_topics" VALUES(92,17);
INSERT INTO "question_topics" VALUES(93,16);
INSERT INTO "question_topics" VALUES(94,16);
INSERT INTO "question_topics" VALUES(95,15);
INSERT INTO "question_topics" VALUES(96,15);
INSERT INTO "question_topics" VALUES(97,16);
INSERT INTO "question_topics" VALUES(98,15);
INSERT INTO "question_topics" VALUES(115,11);
INSERT INTO "question_topics" VALUES(117,2);
INSERT INTO "question_topics" VALUES(116,2);
INSERT INTO "question_topics" VALUES(116,13);
INSERT INTO "question_topics" VALUES(118,2);
INSERT INTO "question_topics" VALUES(118,13);
INSERT INTO "question_topics" VALUES(119,5);
INSERT INTO "question_topics" VALUES(119,6);
INSERT INTO "question_topics" VALUES(99,17);
INSERT INTO "question_topics" VALUES(100,17);
INSERT INTO "question_topics" VALUES(101,17);
INSERT INTO "question_topics" VALUES(102,16);
INSERT INTO "question_topics" VALUES(103,16);
INSERT INTO "question_topics" VALUES(104,16);
INSERT INTO "question_topics" VALUES(105,16);
INSERT INTO "question_topics" VALUES(106,16);
INSERT INTO "question_topics" VALUES(107,15);
INSERT INTO "question_topics" VALUES(108,15);
INSERT INTO "question_topics" VALUES(109,15);
INSERT INTO "question_topics" VALUES(110,15);
INSERT INTO "question_topics" VALUES(111,15);
INSERT INTO "question_topics" VALUES(112,17);
INSERT INTO "question_topics" VALUES(113,14);
INSERT INTO "question_topics" VALUES(114,16);
INSERT INTO "question_topics" VALUES(120,18);
INSERT INTO "question_topics" VALUES(121,18);
INSERT INTO "question_topics" VALUES(122,5);
INSERT INTO "question_topics" VALUES(123,7);
INSERT INTO "question_topics" VALUES(124,6);
INSERT INTO "question_topics" VALUES(125,5);
INSERT INTO "question_topics" VALUES(126,7);
INSERT INTO "question_topics" VALUES(127,2);
INSERT INTO "question_topics" VALUES(128,2);
INSERT INTO "question_topics" VALUES(129,6);
INSERT INTO "question_topics" VALUES(130,6);
INSERT INTO "question_topics" VALUES(130,13);
INSERT INTO "question_topics" VALUES(131,2);
INSERT INTO "question_topics" VALUES(132,18);
INSERT INTO "question_topics" VALUES(133,5);
INSERT INTO "question_topics" VALUES(134,2);
INSERT INTO "question_topics" VALUES(135,5);
INSERT INTO "question_topics" VALUES(136,13);
INSERT INTO "question_topics" VALUES(142,13);
INSERT INTO "question_topics" VALUES(143,5);
INSERT INTO "question_topics" VALUES(144,19);
INSERT INTO "question_topics" VALUES(145,9);
INSERT INTO "question_topics" VALUES(146,5);
INSERT INTO "question_topics" VALUES(147,5);
INSERT INTO "question_topics" VALUES(148,9);
INSERT INTO "question_topics" VALUES(149,5);
INSERT INTO "question_topics" VALUES(150,4);
INSERT INTO "question_topics" VALUES(151,5);
INSERT INTO "question_topics" VALUES(197,20);
INSERT INTO "question_topics" VALUES(223,23);
INSERT INTO "question_topics" VALUES(224,26);
INSERT INTO "question_topics" VALUES(225,26);
INSERT INTO "question_topics" VALUES(225,28);
INSERT INTO "question_topics" VALUES(226,26);
INSERT INTO "question_topics" VALUES(227,28);
INSERT INTO "question_topics" VALUES(228,29);
INSERT INTO "question_topics" VALUES(228,28);
INSERT INTO "question_topics" VALUES(229,26);
INSERT INTO "question_topics" VALUES(229,27);
INSERT INTO "question_topics" VALUES(230,26);
INSERT INTO "question_topics" VALUES(231,25);
INSERT INTO "question_topics" VALUES(232,24);
CREATE TABLE user_question_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    response_content TEXT,
    selected_option TEXT,
    marks_awarded INTEGER,
    marker_notes TEXT,
    is_completed BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (question_id) REFERENCES exam_questions(id),
    UNIQUE(user_id, question_id)
);
INSERT INTO "user_question_attempts" VALUES(1,1,7,'23',NULL,1,'',0,'2026-01-14 08:05:57','2026-01-16 00:46:02');
INSERT INTO "user_question_attempts" VALUES(2,1,8,'67',NULL,0,'',0,'2026-01-14 08:06:04','2026-01-14 21:33:46');
INSERT INTO "user_question_attempts" VALUES(5,1,2,'',NULL,0,'',0,'2026-01-15 02:59:38','2026-01-16 00:45:27');
INSERT INTO "user_question_attempts" VALUES(6,1,3,'',NULL,1,'',0,'2026-01-15 02:59:38','2026-01-16 00:45:34');
INSERT INTO "user_question_attempts" VALUES(7,1,5,'',NULL,0,'',0,'2026-01-15 02:59:38','2026-01-15 03:00:42');
INSERT INTO "user_question_attempts" VALUES(8,1,6,'',NULL,0,'',0,'2026-01-15 02:59:38','2026-01-16 00:45:44');
INSERT INTO "user_question_attempts" VALUES(13,13,1,'2pi/3',NULL,1,'',1,'2026-01-15 03:09:49','2026-01-15 03:09:49');
INSERT INTO "user_question_attempts" VALUES(14,11,1,'2pi/3',NULL,0,'',1,'2026-01-15 03:10:45','2026-01-15 03:10:45');
INSERT INTO "user_question_attempts" VALUES(24,5,15,replace(replace('a=1\r\nb=-2\r\nc=2\r\nd=-12','\r',char(13)),'\n',char(10)),NULL,3,'',1,'2026-01-17 06:08:55','2026-01-17 06:08:55');
INSERT INTO "user_question_attempts" VALUES(25,5,17,'(2,1)',NULL,2,'',1,'2026-01-17 06:08:55','2026-01-17 06:08:55');
INSERT INTO "user_question_attempts" VALUES(26,7,6,replace(replace('5/4\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n','\r',char(13)),'\n',char(10)),NULL,2,'',1,'2026-01-17 08:21:23','2026-01-17 08:21:23');
CREATE TABLE mock_exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    exam_name TEXT, 
    created_method TEXT NOT NULL, 
    
    
    allowed_time_seconds INTEGER, 
    elapsed_time_seconds INTEGER DEFAULT 0, 
    is_timed BOOLEAN DEFAULT 0,
    
    
    status TEXT DEFAULT 'in_progress', 
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id)
);
INSERT INTO "mock_exams" VALUES(7,5,'Mathematics 3U','Test','auto',0,NULL,0,'completed','2026-01-17 06:01:42','2026-01-17 06:08:29');
INSERT INTO "mock_exams" VALUES(8,7,'Mathematics 3U','Custom Exam','manual',0,NULL,0,'completed','2026-01-17 08:20:35','2026-01-17 08:21:13');
INSERT INTO "mock_exams" VALUES(9,7,'Mathematics 3U','Custom Exam','manual',0,NULL,0,'completed','2026-01-17 08:21:36','2026-01-17 08:21:42');
INSERT INTO "mock_exams" VALUES(10,1,'Mathematics 3U','Custom Exam','manual',0,0,0,'in_progress','2026-01-17 08:27:01',NULL);
INSERT INTO "mock_exams" VALUES(11,1,'Mathematics 3U','Custom Exam','manual',0,0,0,'in_progress','2026-01-17 08:27:12',NULL);
INSERT INTO "mock_exams" VALUES(12,27,'Mathematics 3U','Test','auto',0,0,0,'completed','2026-02-12 02:39:24','2026-02-12 02:41:41');
CREATE TABLE mock_exam_questions (
    mock_exam_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    ordering_index INTEGER NOT NULL, response_content TEXT, selected_option TEXT, marks_awarded INTEGER, marker_notes TEXT, 
    
    PRIMARY KEY (mock_exam_id, question_id),
    FOREIGN KEY (mock_exam_id) REFERENCES mock_exams(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES exam_questions(id)
);
INSERT INTO "mock_exam_questions" VALUES(7,15,0,replace(replace('a=1\r\nb=-2\r\nc=2\r\nd=-12','\r',char(13)),'\n',char(10)),NULL,3,'');
INSERT INTO "mock_exam_questions" VALUES(7,17,1,'(2,1)',NULL,2,'');
INSERT INTO "mock_exam_questions" VALUES(8,6,0,replace(replace('5/4\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n','\r',char(13)),'\n',char(10)),NULL,2,'');
INSERT INTO "mock_exam_questions" VALUES(9,13,0,'a',NULL,NULL,NULL);
INSERT INTO "mock_exam_questions" VALUES(10,2,0,NULL,NULL,NULL,NULL);
INSERT INTO "mock_exam_questions" VALUES(11,3,0,NULL,NULL,NULL,NULL);
INSERT INTO "mock_exam_questions" VALUES(12,12,0,NULL,NULL,NULL,NULL);
INSERT INTO "mock_exam_questions" VALUES(12,16,1,NULL,NULL,NULL,NULL);
INSERT INTO "mock_exam_questions" VALUES(12,15,2,NULL,NULL,NULL,NULL);
INSERT INTO "mock_exam_questions" VALUES(12,5,3,NULL,NULL,NULL,NULL);
INSERT INTO "mock_exam_questions" VALUES(12,18,4,NULL,NULL,NULL,NULL);
INSERT INTO "mock_exam_questions" VALUES(12,28,5,NULL,NULL,NULL,NULL);
INSERT INTO "mock_exam_questions" VALUES(12,120,6,NULL,NULL,NULL,NULL);
INSERT INTO "mock_exam_questions" VALUES(12,131,7,NULL,NULL,NULL,NULL);
CREATE TABLE user_review_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    response_content TEXT,
    selected_option TEXT,
    marks_awarded INTEGER,
    marker_notes TEXT,
    is_completed BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (question_id) REFERENCES exam_questions(id)
);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" VALUES('users',35);
INSERT INTO "sqlite_sequence" VALUES('d1_migrations',16);
INSERT INTO "sqlite_sequence" VALUES('resources',5);
INSERT INTO "sqlite_sequence" VALUES('announcements',7);
INSERT INTO "sqlite_sequence" VALUES('posts',7);
INSERT INTO "sqlite_sequence" VALUES('topics',29);
INSERT INTO "sqlite_sequence" VALUES('questions',1);
INSERT INTO "sqlite_sequence" VALUES('comments',17);
INSERT INTO "sqlite_sequence" VALUES('essays',8);
INSERT INTO "sqlite_sequence" VALUES('essay_comments',5);
INSERT INTO "sqlite_sequence" VALUES('action_logs',139);
INSERT INTO "sqlite_sequence" VALUES('papers',8);
INSERT INTO "sqlite_sequence" VALUES('exam_questions',262);
INSERT INTO "sqlite_sequence" VALUES('user_question_attempts',26);
INSERT INTO "sqlite_sequence" VALUES('mock_exams',12);
