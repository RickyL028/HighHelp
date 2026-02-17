-- Variable for paper_id
-- SET 9 = 123; -- Replace with actual paper_id variable in your environment


-- Segment A --

-- A1
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, mc_answer, ordering_index, question_text, question_image_key)
VALUES (9, 'I', 'A', 'A1', 'I A1', 'multiple_choice', 1, 'D', 1, 'The diagram shows the graph of $$ y^2 = f(x) $$
Which expression best represents the function $$ f(x) $$?
A) $$ x^2(1 - x) $$
B) $$ x^2(x - 1) $$
C) $$ x(1 - x^2) $$
D) $$ x(x^2 - 1) $$', 'q_A1_graph');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 6;

-- A2
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, mc_answer, ordering_index, question_text)
VALUES (9, 'I', 'A', 'A2', 'I A2', 'multiple_choice', 1, 'A', 2, 'What is the natural domain of the function $$ f(x) = \frac{1}{2} (x \sqrt{x^2 - 1} - \log_e (x + \sqrt{x^2 - 1})) $$?
A) $$ x \ge 1 $$
B) $$ x \le -1 $$
C) $$ -1 \le x \le 1 $$
D) $$ x \le -1 \text{ or } x \ge 1 $$');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 5;

-- A3
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, ordering_index, question_text, answer_text)
VALUES (9, 'II', 'A', 'A3', 'II A3', 'short_answer', 3, 3, 'Solve for $$ k $$ in the following: $$ \frac{2k}{1-k} \ge k $$', '$$ k \le -1 \text{ or } 0 \le k < 1 $$');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 12;

-- A4
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, ordering_index, question_text, answer_text)
VALUES (9, 'II', 'A', 'A4', 'II A4', 'short_answer', 3, 4, 'Find the Cartesian equation which is defined parametrically as
$$ \begin{cases} x = \sqrt{t} \\ y = 2\sqrt{1 - t} \end{cases} $$', '$$ y^2 = 4(1 - t) \implies y^2 = 4(1 - x^2) $$
Domain: $$ 0 \le x \le 1 $$
Range: $$ 0 \le y \le 2 $$');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 5;

-- A5
-- Stimulus for A5
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, ordering_index, question_text, stimulus_text, stimulus_image_key)
VALUES (9, 'II', 'A', 'A5', 'II A5', 'short_answer', 7, 5, 'Sketch the following functions in the provided grid, indicate all important features.
i) $$ y = (f(x))^2 $$ (2 marks)
ii) $$ y = \frac{1}{f(x)} $$ (2 marks)
iii) $$ y^2 = |f(x)| $$ (3 marks)', 'The diagram shows the graph of a function $$ f(x) = 2 - e^x $$.', 's_A5_graph');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 6;

-- Segment B --

-- B1
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, mc_answer, ordering_index, question_text, question_image_key)
VALUES (9, 'I', 'B', 'B1', 'I B1', 'multiple_choice', 1, 'C', 6, 'A monic polynomial $$ p(x) $$ of degree 4 has one repeated zero of multiplicity 2 and is divisible by $$ x^2 + x + 1 $$. Which of the following could be the graph of $$ p(x) $$?', 'q_B1_options');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 8;

-- B2
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, ordering_index, question_text, answer_text)
VALUES (9, 'II', 'B', 'B2', 'II B2', 'short_answer', 2, 7, 'Show that $$ (x - 1)(x - 2) $$ is a factor of $$ P(x) = x^n(2^m - 1) + x^m(1 - 2^n) + (2^n - 2^m) $$ where $$ m $$ and $$ n $$ are positive integers.', 'Proof showing $$ P(1) = 0 $$ and $$ P(2) = 0 $$.');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 8;

-- B3
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, ordering_index, question_text, answer_text)
VALUES (9, 'II', 'B', 'B3', 'II B3', 'short_answer', 5, 8, '$$ \alpha, \beta $$ and $$ \gamma $$ are solutions of $$ 2x^3 - 4x^2 - 3x - 1 $$,
i) find the value of $$ \alpha\beta + \beta\gamma + \alpha\gamma $$ (1 mark)
ii) find the value of $$ (\alpha - 1)(\beta - 1)(\gamma - 1) $$ (2 marks)
iii) Hence or otherwise, find the value of $$ (\beta + \gamma - \alpha)(\gamma + \alpha - \beta)(\alpha + \beta - \gamma) $$ (2 marks)', 'i) $$ -\frac{3}{2} $$
ii) $$ 3 $$
iii) $$ -24 $$');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 8;

-- B4
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, ordering_index, question_text, answer_text)
VALUES (9, 'II', 'B', 'B4', 'II B4', 'short_answer', 3, 9, 'The polynomial $$ P(x) = x^3 + ax^2 + b $$ has a zero at $$ r $$ and a double zero at 4.
Find the values of $$ a, b $$ and $$ r $$.', '$$ a = -6 $$
$$ b = 32 $$
$$ r = -2 $$');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 8;

-- B5
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, ordering_index, question_text, answer_text)
VALUES (9, 'II', 'B', 'B5', 'II B5', 'short_answer', 3, 10, 'When a polynomial is divided by $$ x, (x - 2) $$ and $$ (x + 3) $$, the remainders are 1, 3 and 13 respectively. If the same polynomial is divided by $$ x(x - 2)(x + 3) $$, the remainder is $$ g(x) $$, then find the value of $$ g(1) $$.', '$$ g(1) = 1 $$');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 8;

-- Segment C --

-- C1
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, mc_answer, ordering_index, question_text)
VALUES (9, 'I', 'C', 'C1', 'I C1', 'multiple_choice', 1, 'C', 11, 'Four female and four male athletes are arranged in a row for the presentation of prizes. In how many ways can this be done if the males and females must alternate?
A) $$ 4! \times 4! $$
B) $$ 4! \times 5! $$
C) $$ 2 \times 4! \times 4! $$
D) $$ 2 \times 4! \times 5! $$');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 10;

-- C2
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, mc_answer, ordering_index, question_text)
VALUES (9, 'I', 'C', 'C2', 'I C2', 'multiple_choice', 1, 'C', 12, 'Four digit numbers are formed from the digits 1, 2, 3 and 4. Each digit is used once only. The sum of all the numbers that can be formed is?
A) 6666
B) 44440
C) 66660
D) 266640');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 10;

-- C3
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, ordering_index, question_text, answer_text)
VALUES (9, 'II', 'C', 'C3', 'II C3', 'short_answer', 2, 13, 'How many distinct arrangements are there of the letters of the word ERATOSTHENES?', '$$ \frac{12!}{3!2!2!} = 19,958,400 $$');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 10;

-- C4
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, ordering_index, question_text, answer_text)
VALUES (9, 'II', 'C', 'C4', 'II C4', 'short_answer', 2, 14, 'A child has the following six plastic magnetic numbers: 6,2,6,7,6,2
How many different values can be created by using only five of the magnetic numbers?', '60');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 10;

-- Segment D --

-- D1
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, ordering_index, question_text, answer_text)
VALUES (9, 'II', 'D', 'D1', 'II D1', 'short_answer', 2, 15, 'Find the exact value of $$ \tan[\cos^{-1}(-\frac{1}{\sqrt{2}}) - \sin^{-1}(-\frac{1}{\sqrt{2}})] $$, show working out.', '0');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 4;

-- D2
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, ordering_index, question_text, answer_text)
VALUES (9, 'II', 'D', 'D2', 'II D2', 'short_answer', 3, 16, 'Show that if $$ \tan X = \frac{7m+6}{7-6m} $$ and $$ \tan Y = \frac{4m+3}{4-3m} $$, the value of $$ \tan (X - Y) $$ is independent of m.', '$$ \tan(X-Y) = \frac{3}{46} $$');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 4;

-- D3
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, ordering_index, question_text, answer_text, stimulus_text, stimulus_image_key)
VALUES (9, 'II', 'D', 'D3', 'II D3', 'short_answer', 6, 17, 'i) What is the largest positive domain, containing $$ x = 0 $$, for which $$ f(x) $$ has an inverse function? (1 mark)
ii) Find the equation of $$ f^{-1}(x) $$. (1 mark)
iii) Sketch the curve $$ y = f^{-1}(x) $$, showing all important features. (2 marks)
iv) $$ A(a,0) $$ lies to the right of $$ P(2\pi, -2) $$ as indicated in the diagram. Find a simplified expression for the exact value of $$ f^{-1}(f(a)) $$. (2 marks)', 'i) $$ 0 \le x \le 2\pi $$
ii) $$ y = 2\cos^{-1}(\frac{1}{3}(x-1)) $$
iv) $$ 4\pi - a $$', 'Let $$ f(x) = 1 + 3 \cos \frac{x}{2} $$. The diagram shows the graph of $$ y = f(x) $$.', 's_D3_graph');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 5;

-- D4
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, ordering_index, question_text, answer_text)
VALUES (9, 'II', 'D', 'D4', 'II D4', 'short_answer', 5, 18, 'i) Use the substitution $$ t = \tan \frac{x}{2} $$ to show that:
$$ 2\sin x - 3\cos x = \frac{3t^2 + 4t - 3}{1 + t^2} $$ (2 marks)
ii) Hence solve the equation $$ 2\sin x - 3\cos x = 2 $$ for $$ 0^\circ \le x \le 360^\circ $$.
Answer correct to the nearest degree. (3 marks)', 'ii) $$ x \approx 90^\circ, 203^\circ $$');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 4;

-- D5
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, ordering_index, question_text, answer_text)
VALUES (9, 'II', 'D', 'D5', 'II D5', 'short_answer', 4, 19, 'i) Use the fact that $$ \cos 3\theta = 4 \cos^3 \theta - 3 \cos \theta $$, solve $$ 8x^3 - 6x - 1 = 0 $$ (2 marks)
ii) Hence, show that $$ \cos \frac{\pi}{9} = \cos \frac{2\pi}{9} + \cos \frac{4\pi}{9} $$ (2 marks)', 'i) $$ x = \cos \frac{\pi}{9}, \cos \frac{5\pi}{9}, \cos \frac{7\pi}{9} $$');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 4;

-- Segment E --

-- E1
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, ordering_index, question_text, answer_text)
VALUES (9, 'II', 'E', 'E1', 'II E1', 'short_answer', 2, 20, 'Find the term in $$ x^5 $$ in the expansion of $$ (2x - \frac{1}{x^2})^8 $$.', '$$ -1024x^5 $$');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 2;

-- E2
INSERT INTO exam_questions (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, ordering_index, question_text, answer_text)
VALUES (9, 'II', 'E', 'E2', 'II E2', 'short_answer', 7, 21, 'i) Show that $$ (1 + x)^m (1 - \frac{1}{x})^m = (x - \frac{1}{x})^m $$ (1 mark)
ii) By considering the term(s) independent of $$ x $$ in the expansion of the results from part i, show that:
$$ \binom{2002}{0}^2 - \binom{2002}{1}^2 + \binom{2002}{2}^2 - \dots + \binom{2002}{2002}^2 = -1 \binom{2002}{1001} $$ (3 marks)
iii) Hence, or otherwise, show that
$$ \sum_{k=0}^{1001} (-1)^k \binom{2002}{k}^2 = -\frac{1}{2} \binom{2002}{1001} [1 + \binom{2002}{1001}] $$ (3 marks)', 'Proof exam_questions.');

INSERT INTO question_topics (question_id, topic_id) SELECT last_insert_rowid(), 10;

