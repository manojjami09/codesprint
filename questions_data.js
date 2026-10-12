'use strict';

// Official CODE SPRINT question data.
// Adaptations: C snippets from the brief are reproduced in Python with the SAME bug/logic so
// the platform can auto-grade them (no C compiler installed on this host). Answers for
// aptitude/MCQ accept the option letter OR the value.

function C(round, stage, section, title, marks, statement, input_desc, output_desc, examples, test_cases, hint, penalty, starter, isBonus, qtype) {
  return {
    round, stage, section, qtype: qtype || 'code', title, statement, input_desc, output_desc,
    constraints: 'See problem statement', examples, marks, hint, hint_penalty: penalty,
    starter_code: starter || '', language: qtype === 'logic' ? 'text' : 'python', time_limit_ms: 4000,
    order_index: 0, is_bonus: isBonus ? 1 : 0, test_cases,
  };
}

function M(round, stage, section, title, marks, question, options, ansIndex, hint, penalty) {
  const letter = options ? String.fromCharCode(65 + ansIndex) : null;
  const ansValue = options ? options[ansIndex] : '';
  const optsText = options
    ? '\n\nOptions:\n' + options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n')
    : '';
  const alts = [];
  if (letter) alts.push(letter);
  if (ansValue) alts.push(ansValue);
  if (letter && ansValue) alts.push(`${letter}) ${ansValue}`);
  return C(round, stage, section, title, marks, question + optsText,
    'Type the answer — the option letter (e.g. B) or the value.', 'The correct option or value.',
    [['(answer can be typed as a letter or value)', ansValue]],
    [['', [...new Set(alts)].join('\n'), 1]],
    hint, penalty, '', 0, 'logic');
}

const QUESTIONS = [];

// ======================================================================
// ROUND 1 — LOGIC QUEST   |   GATE (Quantitative Aptitude)
// ======================================================================
QUESTIONS.push(
  M(1, 'The Gate', 'Quantitative Aptitude', 'Q1. Percentages', 6,
    'A student scored 360 marks out of 500. What percentage did the student score?',
    ['68%', '70%', '72%', '75%'], 2,
    'Divide 360 by 500 and multiply by 100.', 2),

  M(1, 'The Gate', 'Quantitative Aptitude', 'Q2. Ratio', 6,
    'The ratio of boys to girls in a class is 3 : 2. If there are 45 boys, how many students are there in total?',
    ['60', '70', '75', '80'], 2,
    '45 boys = 3 parts, so 1 part = 15. Total parts = 5.', 2),

  M(1, 'The Gate', 'Quantitative Aptitude', 'Q3. Time & Work', 8,
    'A can complete a task in 12 days and B can complete the same task in 18 days. If they work together, how many days will they take?',
    ['6.2 days', '7.2 days', '8 days', '9 days'], 1,
    'Use 1/A + 1/B, then take the reciprocal.', 3),

  M(1, 'The Gate', 'Quantitative Aptitude', 'Q4. Probability', 10,
    'A box contains 5 red, 4 blue and 3 green balls. One ball is selected at random. What is the probability that the ball is neither red nor green?',
    ['1/4', '1/3', '4/12', '5/12'], 1,
    'Neither red nor green means blue: 4 favourable out of 12.', 3),

  M(1, 'The Gate', 'Quantitative Aptitude', 'Q5. Average & Replacement', 10,
    'The average age of 8 students is 20 years. When one student leaves the group, the average becomes 19 years. What was the age of the student who left?',
    ['25 years', '26 years', '27 years', '28 years'], 2,
    'Original total = 160, new total = 133, difference = 27.', 3),

  // ======================================================================
  // ROUND 1 | MAZE (Logical Reasoning)
  // ======================================================================
  M(1, 'The Maze', 'Logical Reasoning', 'Q6. Direction Sense', 8,
    'A person walks 8 m north, then turns right and walks 6 m. He then turns right again and walks 8 m. Where is he now with respect to his starting point?',
    ['6 m East', '6 m West', '8 m East', '8 m South'], 0,
    'The two 8 m walks cancel; only the 6 m remains.', 3),

  M(1, 'The Maze', 'Logical Reasoning', 'Q7. Number Pattern', 8,
    'Find the missing number: 4, 9, 19, 39, 79, ?',
    ['149', '158', '159', '160'], 2,
    'Each term is previous × 2 + 1.', 3),

  M(1, 'The Maze', 'Logical Reasoning', 'Q8. Seating Arrangement', 10,
    'Six students P, Q, R, S, T and U are sitting in a row.\n• P sits to the left of Q.\n• R sits immediately to the right of Q.\n• S sits to the left of P.\n• T sits to the right of R.\n• U sits at the extreme left.\nWho occupies the third position from the left?',
    ['P', 'Q', 'R', 'S'], 0,
    'Arrangement: U – S – P – Q – R – T.', 3),

  M(1, 'The Maze', 'Logical Reasoning', 'Q9. Logical Deduction', 10,
    'Five people A, B, C, D and E have different heights.\n• A is taller than B.\n• C is shorter than D.\n• B is taller than C.\n• D is shorter than A.\nWho is definitely the tallest?',
    ['A', 'B', 'C', 'D'], 0,
    'A > B > C and A > D > C, so A beats everyone.', 3),

  M(1, 'The Maze', 'Logical Reasoning', 'Q10. Arrangement', 12,
    'Seven people A, B, C, D, E, F and G are standing in a line.\n• B is immediately to the right of A.\n• C is somewhere to the left of A.\n• D is immediately to the right of E.\n• F is at the extreme left.\n• G is between C and A.\nWhich of the following could be the correct arrangement?',
    ['F C G A B E D', 'F G C A B E D', 'C F G A B D E', 'F C A G B E D'], 0,
    'Check A–B together, E–D together, F at left, G between C and A.', 4),

  // ======================================================================
  // ROUND 1 | CIPHER (Reasoning & Pattern Recognition)
  // ======================================================================
  M(1, 'The Cipher', 'Reasoning & Pattern Recognition', 'Q11. Letter Coding', 10,
    'If CAT → DBU using the same pattern, what is DOG → ?',
    ['EPH', 'EOG', 'FPH', 'DPH'], 0,
    'Each letter moves one position forward.', 3),

  M(1, 'The Cipher', 'Reasoning & Pattern Recognition', 'Q12. Number Coding', 10,
    'If APPLE = 50, using A=1, B=2, ..., Z=26, what is GRAPE = ?',
    ['45', '47', '49', '51'], 1,
    'G+R+A+P+E = 7+18+1+16+5 = 47.', 3),

  M(1, 'The Cipher', 'Reasoning & Pattern Recognition', 'Q13. Reverse Coding', 12,
    'In a certain code TABLE → GZYOV (each letter replaced by its opposite: A↔Z, B↔Y, C↔X ...). Using the same rule, what is CHAIR → ?',
    ['XSZRI', 'XHZRI', 'XZRIS', 'SXZIR'], 0,
    'C→X, H→S, A→Z, I→R, R→I.', 4),

  M(1, 'The Cipher', 'Reasoning & Pattern Recognition', 'Q14. Pattern Coding', 12,
    'In a certain code ROAD → 18-15-1-4 and GAME → 7-1-13-5. What would be the code for CODE?',
    ['3-15-4-5', '4-15-3-5', '3-14-4-5', '2-15-4-6'], 0,
    'C=3, O=15, D=4, E=5.', 4),

  M(1, 'The Cipher', 'Reasoning & Pattern Recognition', 'Q15. Pattern Recognition ⭐', 15,
    'A special code follows an unknown rule: 2 → 6, 3 → 12, 4 → 20, 5 → 30, 6 → 42. Using the same rule, 8 → ?',
    ['56', '64', '72', '80'], 2,
    'Value = n × (n + 1). 8 × 9 = 72.', 5),
);

// ======================================================================
// ROUND 2 — CODE ARENA
// ======================================================================
const R2A = (q) => Object.assign(q, { round: 2, stage: 'Code Arena' });

// ---- PREDICT (30 marks, 3 × 10) ---------------------------------------
QUESTIONS.push(...[
  R2A(M(2, 'Code Arena', 'PREDICT', 'Q1. Trace the Swap (Easy)', 10,
    'Predict the output of the following code:\n\nx = 5\ny = 2\nx = x + y\ny = x - y\nx = x - y\nprint(x, y)',
    ['5 2', '2 5', '7 5', '5 7'], 1,
    'This performs a classic swap using only x and y.', 3)),

  R2A(M(2, 'Code Arena', 'PREDICT', 'Q2. Trace the Loop (Moderate)', 10,
    'Predict the output of the following code:\n\nx = 10\nfor i in range(1, 4):\n    x = x - i\nprint(x)',
    ['3', '4', '5', '6'], 1,
    '10 − 1 − 2 − 3 = 4.', 3)),

  R2A(M(2, 'Code Arena', 'PREDICT', 'Q3. Trace the Loop (Hard)', 10,
    'Predict the output of the following code:\n\narr = [2, 4, 6, 8]\nresult = 0\nfor i in range(len(arr)):\n    result += arr[i] * i\nprint(result)',
    ['30', '40', '44', '50'], 2,
    '2×0 + 4×1 + 6×2 + 8×3 = 44.', 4)),
]);

// ---- FIX IT (30 marks, 2 × 15) ----------------------------------------
QUESTIONS.push(
  R2A(C(2, 'Code Arena', 'FIX IT', 'Q4. Find the Bug (Smallest)', 15,
    'The program below should print the smallest element in an array, but it fails for some inputs.\n\nThe bug: `smallest` is initialised to 0, which is wrong when all numbers are positive.\n\nTask: fix the bug so it prints the true smallest number for ANY input.\n\nInput: first line N, second line N integers.\nOutput: the smallest integer.',
    'First line N. Second line N integers.', 'The smallest integer.',
    [['4\n8 3 12 5', '3']],
    [['5\n8 3 12 5 1', '1', 1], ['4\n-5 -2 -10 -3', '-10', 0]],
    'Initialise smallest = arr[0] instead of 0.', 5,
    'n = int(input())\narr = list(map(int, input().split()))\nsmallest = 0\nfor x in arr:\n    if x < smallest:\n        smallest = x\nprint(smallest)')),

  R2A(C(2, 'Code Arena', 'FIX IT', 'Q5. Hidden Loop Bug (Count 1–5)', 15,
    'The program should print 1 2 3 4 5, but it runs forever.\n\nThe bug: the counter is decremented instead of incremented.\n\nTask: fix the loop so it prints 1 2 3 4 5 exactly.',
    'No input (fixed loop).', '1 2 3 4 5',
    [['', '1 2 3 4 5']],
    [['', '1 2 3 4 5', 1]],
    'The update step uses i -= 1; it must be i += 1.', 5,
    'i = 1\nwhile i <= 5:\n    print(i, end=" ")\n    i -= 1')),

  // ---- COMPLETE IT (30 marks, 3 × 10) ----------------------------------
  R2A(C(2, 'Code Arena', 'COMPLETE IT', 'Q6. Complete the Function (Square)', 10,
    'Complete the function so it returns the square of a number. Fill in the missing line (where you see ______) so the program prints 36.',
    'No input.', '36',
    [['', '36']],
    [['', '36', 1]],
    'Return n multiplied by n.', 3,
    'def square(n):\n    ______\n\nprint(square(6))')),

  R2A(C(2, 'Code Arena', 'COMPLETE IT', 'Q7. Complete the Condition (Contains)', 10,
    'Complete the condition (where you see ______) so the program checks whether the target value 9 appears in the array, and prints YES if it does.',
    'No input.', 'YES',
    [['', 'YES']],
    [['', 'YES', 1]],
    'Compare each array element to target with ==.', 3,
    'arr = [4, 7, 2, 9, 5]\ntarget = 9\nfound = 0\nfor i in range(len(arr)):\n    if ______:\n        found = 1\n        break\nprint("YES" if found else "NO")')),

  R2A(C(2, 'Code Arena', 'COMPLETE IT', 'Q8. Complete the Logic (Reverse)', 10,
    'Complete the range(______) so the loop reads the string s = "HELLO" from the END to the START and builds rev. The program must print OLLEH.\n\nFill in: for i in range(______):',
    'No input.', 'OLLEH',
    [['', 'OLLEH']],
    [['', 'OLLEH', 1]],
    'Use a reversed range: len(s)-1 down to 0 step -1.', 3,
    's = "HELLO"\nrev = ""\nfor i in range(______):\n    rev += s[i]\nprint(rev)')),

  // ---- SOLVE (30 marks, 3 × 10) ----------------------------------------
  R2A(C(2, 'Code Arena', 'SOLVE', 'Q9. Two Sum', 10,
    'Given an array and a target, determine whether two DIFFERENT elements of the array add up to the target. Print Yes if found, else No.',
    'First line N. Second line N integers. Third line the target T.',
    'Yes if two different elements sum to T, else No.',
    [['6\n2 7 11 15 3 6\n9', 'Yes']],
    [['6\n2 7 11 15 3 6\n9', 'Yes', 1], ['4\n1 2 3 4\n100', 'No', 0]],
    'For each element check whether target - element exists elsewhere.', 4,
    'n = int(input())\narr = list(map(int, input().split()))\ntarget = int(input())\n# write your logic here')),

  R2A(C(2, 'Code Arena', 'SOLVE', 'Q10. Character Frequency', 10,
    'Given a string, print each character (in order of first appearance) with its frequency. Format: one character per line as: <char> <count>. Ignore spaces.',
    'A single line of text.', 'One line per unique character: <char> <count>.',
    [['PROGRAMMING', 'P 1\nR 2\nO 1\nG 2\nA 1\nM 2\nI 1\nN 1']],
    [['PROGRAMMING', 'P 1\nR 2\nO 1\nG 2\nA 1\nM 2\nI 1\nN 1', 1], ['AAA BBB', 'A 3\nB 3', 0]],
    'Use a dictionary to count, then print in order of first occurrence.', 4,
    's = input().replace(" ", "")\n# write your logic here')),

  R2A(C(2, 'Code Arena', 'SOLVE', 'Q11. Rotate Array', 10,
    'Rotate an array to the RIGHT by K positions. Print the resulting array space-separated.',
    'First line N. Second line N integers. Third line K.',
    'The rotated array, space-separated.',
    [['5\n1 2 3 4 5\n2', '4 5 1 2 3']],
    [['5\n1 2 3 4 5\n2', '4 5 1 2 3', 1], ['3\n1 2 3\n0', '1 2 3', 0], ['4\n1 2 3 4\n5', '4 1 2 3', 0]],
    'Effective rotation is K % N. Slice splicing is the easiest approach.', 4,
    'n = int(input())\narr = list(map(int, input().split()))\nk = int(input())\n# write your logic here')),

  // ---- CHALLENGE (20 marks, 3 = 7,7,6) ----------------------------------
  R2A(C(2, 'Code Arena', 'CHALLENGE', 'Q12. Longest Increasing Subarray ⭐', 7,
    'Find the length of the longest contiguous STRICTLY increasing portion of the array.',
    'First line N. Second line N integers.',
    'The maximum length of a contiguous strictly increasing subarray.',
    [['8\n1 2 3 2 3 4 5 1', '4']],
    [['8\n1 2 3 2 3 4 5 1', '4', 1], ['5\n5 4 3 2 1', '1', 0]],
    'One pass: keep a running streak, reset it when the order breaks.', 4,
    'n = int(input())\narr = list(map(int, input().split()))\n# write your logic here')),

  R2A(C(2, 'Code Arena', 'CHALLENGE', 'Q13. First Non-Repeating Character ⭐', 7,
    'Given a string, find the FIRST character that occurs exactly once. If none exists, print -1.',
    'A single word.', 'The first character that occurs once, else -1.',
    [['SWISS', 'W']],
    [['SWISS', 'W', 1], ['racecars', 'e', 0], ['AABB', '-1', 0]],
    'Count frequencies first, then scan the string in order.', 4,
    's = input().strip()\n# write your logic here')),

  R2A(C(2, 'Code Arena', 'CHALLENGE', 'Q14. Maximum Subarray Sum ⭐', 6,
    'Given an array containing positive and negative integers, find the maximum sum of a contiguous subarray.',
    'First line N. Second line N integers.', 'The maximum subarray sum.',
    [['8\n-2 1 -3 4 -1 2 1 -5', '6']],
    [['8\n-2 1 -3 4 -1 2 1 -5', '6', 1], ['3\n-1 -2 -3', '-1', 0]],
    'Kadane\'s algorithm: keep a running best, reset when it goes negative.', 5,
    'n = int(input())\narr = list(map(int, input().split()))\n# write your logic here')),

  // ---- CODING — BONUS (extra marks, 6 × 5) -----------------------------
  R2A(C(2, 'Code Arena', 'BONUS — Coding', 'B15. Palindrome String ⭐', 5,
    'Determine whether a given string is a palindrome (reads the same forwards and backwards). Print Palindrome or Not Palindrome.',
    'A single word.', 'Palindrome or Not Palindrome.',
    [['MADAM', 'Palindrome']],
    [['MADAM', 'Palindrome', 1], ['sprint', 'Not Palindrome', 0]],
    'Compare the string with its reverse.', 3,
    's = input().strip()\n# write your logic here', 1)),

  R2A(C(2, 'Code Arena', 'BONUS — Coding', 'B16. Second Largest Distinct ⭐', 5,
    'Find the SECOND LARGEST DISTINCT element without sorting. If it does not exist, print -1.',
    'First line N. Second line N integers.', 'The second largest distinct element, else -1.',
    [['7\n10 25 8 25 30 15 30', '25']],
    [['7\n10 25 8 25 30 15 30', '25', 1], ['3\n1 1 1', '-1', 0]],
    'Track largest and second largest in one pass, ignoring duplicates of largest.', 3,
    'n = int(input())\narr = list(map(int, input().split()))\n# write your logic here', 1)),

  R2A(C(2, 'Code Arena', 'BONUS — Coding', 'B17. Move Zeros ⭐', 5,
    'Move all zeros to the END of the array while maintaining the order of the non-zero elements.',
    'First line N. Second line N integers.', 'The array with zeros at the end, space-separated.',
    [['7\n0 1 0 3 12 0 5', '1 3 12 5 0 0 0']],
    [['7\n0 1 0 3 12 0 5', '1 3 12 5 0 0 0', 1], ['5\n1 2 3 4 5', '1 2 3 4 5', 0], ['3\n0 0 0', '0 0 0', 0]],
    'Collect non-zero values first, then append the zeros.', 3,
    'n = int(input())\narr = list(map(int, input().split()))\n# write your logic here', 1)),

  R2A(C(2, 'Code Arena', 'BONUS — Coding', 'B18. Missing Number ⭐', 5,
    'An array contains all numbers from 1 to N EXCEPT one number is missing. Find the missing number.',
    'First line N. Second line N-1 integers (the array without the missing one).',
    'The missing number.',
    [['5\n1 2 4 5', '3']],
    [['5\n1 2 4 5', '3', 1], ['6\n1 2 3 5 6', '4', 0], ['2\n1', '2', 0]],
    'Missing = expected sum of 1..N − actual sum.', 3,
    'n = int(input())\narr = list(map(int, input().split()))\n# write your logic here', 1)),

  R2A(C(2, 'Code Arena', 'BONUS — Coding', 'B19. Merge Two Sorted Arrays ⭐', 5,
    'Given two sorted arrays, merge them into one sorted array.',
    'First line size A. Second line A integers (sorted). Third line size B. Fourth line B integers (sorted).',
    'The merged sorted array, space-separated.',
    [['3\n1 4 7\n4\n2 3 5 8', '1 2 3 4 5 7 8']],
    [['3\n1 4 7\n4\n2 3 5 8', '1 2 3 4 5 7 8', 1], ['1\n1\n1\n2', '1 2', 0], ['1\n10\n1\n5', '5 10', 0]],
    'Merge two pointers while both have elements, then append the remainder.', 3,
    'na = int(input())\na = list(map(int, input().split()))\nnb = int(input())\nb = list(map(int, input().split()))\n# write your logic here', 1)),

  R2A(C(2, 'Code Arena', 'BONUS — Coding', 'B20. Valid Parentheses ⭐', 5,
    'Given a string containing ( ) { } [ ], determine whether the brackets are properly balanced. Print Valid or Invalid.',
    'A string of bracket characters.', 'Valid or Invalid.',
    [['{[()]}', 'Valid'], ['{[(])}', 'Invalid']],
    [['{[()]}', 'Valid', 1], ['{[(])}', 'Invalid', 0], ['', 'Valid', 0]],
    'Use a stack: push openers, pop and match closers.', 3,
    's = input().strip()\n# write your logic here', 1)),
);

// ======================================================================
// ROUND 3 — DEBUG LAB
// ======================================================================
const R3A = (q) => Object.assign(q, { round: 3 });

QUESTIONS.push(
  R3A(C(3, 'Broken Loop', 'Broken Loop', 'Q1. Infinite Loop Fix', 10,
    'The program should print the first 10 even numbers: 2 4 6 8 10 12 14 16 18 20\nbut it never terminates. The update step is wrong.\n\nTask: fix the error so it prints the expected output. (Original C code used while(i <= 20) { printf; i -= 2; }.)',
    'No input (fixed loop).', '2 4 6 8 10 12 14 16 18 20',
    [['', '2 4 6 8 10 12 14 16 18 20']],
    [['', '2 4 6 8 10 12 14 16 18 20', 1]],
    'i -= 2 moves away from the condition; it must be i += 2.', 5,
    'i = 2\nwhile i <= 20:\n    print(i, end=" ")\n    i -= 2')),

  R3A(C(3, 'Broken Loop', 'Broken Loop', 'Q2. Nested Loop Error', 10,
    'The program should print three rows of 1 2 3, but the inner loop stops too early.\n\nExpected output:\n1 2 3\n1 2 3\n1 2 3\n\nTask: find and fix the loop error.',
    'No input (fixed loops).', '1 2 3 (three times, each row on a new line)',
    [['', '1 2 3\n1 2 3\n1 2 3']],
    [['', '1 2 3\n1 2 3\n1 2 3', 1]],
    'range(1, 3) becomes range(1, 4) to include 3.', 5,
    'for i in range(1, 4):\n    for j in range(1, 3):\n        print(j, end=" ")\n    print()')),

  R3A(C(3, 'Hidden Bug', 'Hidden Bug', 'Q3. Hidden Array Bug (Second Largest)', 10,
    'The program should find the SECOND LARGEST DISTINCT element. For 10 25 8 30 15 it prints 25 (correct), but for 30 30 20 15 10 it is wrong.\n\nThe hidden bug: when a value equals the current largest, it is wrongly treated as second-largest.\n\nTask: fix the program for all inputs.',
    'First line N. Second line N integers.', 'The second largest distinct element.',
    [['5\n10 25 8 30 15', '25']],
    [['5\n10 25 8 30 15', '25', 1], ['5\n30 30 20 15 10', '20', 0]],
    'The else-if must also reject arr[i] == largest.', 5,
    'arr = list(map(int, input().split()))\nlargest = arr[0]\nsecond = arr[0]\nfor x in arr:\n    if x > largest:\n        second = largest\n        largest = x\n    elif x > second:\n        second = x\nprint(second)')),

  R3A(C(3, 'Hidden Bug', 'Hidden Bug', 'Q4. Hidden String Bug (Case-Insensitive)', 10,
    'The program compares two strings but is not case-insensitive. Strings like Code / code / CODE / cOdE should ALL be considered equal.\n\nTask: fix the comparison so it ignores case.',
    'First line string A. Second line string B.', 'Same or Different.',
    [['Code\ncode', 'Same']],
    [['Code\ncode', 'Same', 1], ['HELLO\nhello', 'Same', 0], ['Code\ncodex', 'Different', 0]],
    'Convert both strings to lowercase (or uppercase) before comparing, char by char.', 5,
    'a = input().strip()\nb = input().strip()\nsame = True\nfor i in range(len(a)):\n    if a[i] != b[i]:\n        same = False\n        break\nprint("Same" if same else "Different")')),

  R3A(C(3, 'Final Boss', 'Final Boss', 'Q5. Final Boss — Array Rotation 👾', 10,
    'FINAL BOSS. The program rotates an array to the RIGHT by K positions (e.g. 1 2 3 4 5, k=2 → 4 5 1 2 3) but contains a subtle logical error.\n\nThe bug: the last element is saved in a variable `last`, but afterwards the code sets arr[0] = arr[n-1] at the wrong moment — arr[n-1] has already been overwritten by the shifting loop.\n\nTask: fix the rotation.',
    'First line: array values space-separated. Second line: integer K.',
    'The rotated array, space-separated.',
    [['1 2 3 4 5\n2', '4 5 1 2 3']],
    [['1 2 3 4 5\n2', '4 5 1 2 3', 1], ['1 2 3\n1', '3 1 2', 0], ['7 2 9\n2', '2 9 7', 0]],
    'Use the saved `last` for arr[0], not the overwritten arr[n-1].', 6,
    'arr = list(map(int, input().split()))\nk = int(input())\nn = len(arr)\nfor r in range(k % n):\n    last = arr[n-1]\n    for i in range(n-1, 0, -1):\n        arr[i] = arr[i-1]\n    arr[0] = arr[n-1]\nprint(" ".join(map(str, arr)))')),
);

module.exports = QUESTIONS;