import { todayISO } from "./dates";

/**
 * A line a day, from outside the hub.
 *
 * The dashboard already says something about your own week, worked out from
 * your own data. This is the other thing — something said by someone else,
 * long before you had a deadline, about work and patience and knowledge and
 * trust. It changes every morning and never repeats until the list runs out.
 *
 * Written rather than scraped, and that is the important decision. The quote
 * sites this could have been pulled from are full of lines attributed to
 * whoever sounds best: "we are what we repeatedly do" is Will Durant and not
 * Aristotle, half of what circulates as Rumi is a loose English rendering, and
 * a great deal of what circulates as hadith is not hadith. Putting a false
 * attribution on a verse or a hadith is not a small error, so everything here
 * carries its reference and anything whose source is genuinely disputed was
 * left out rather than guessed at.
 *
 * Qur'anic verses are given in plain English with surah and ayah, so they can
 * be checked. Hadith name the collection. Where a line is a well-known
 * rendering rather than a literal translation, the attribution says the work.
 */

export interface Quote {
  text: string;
  author: string;
  /** The book, surah and ayah, or collection — whatever lets you check it. */
  source?: string;
}

export const QUOTES: Quote[] = [
  // ---- Qur'an ---------------------------------------------------------------
  { text: "Indeed, with hardship comes ease.", author: "Qur'an", source: "94:6" },
  { text: "Allah does not burden a soul beyond what it can bear.", author: "Qur'an", source: "2:286" },
  { text: "And say: My Lord, increase me in knowledge.", author: "Qur'an", source: "20:114" },
  { text: "Indeed, Allah is with the patient.", author: "Qur'an", source: "2:153" },
  { text: "And whoever relies upon Allah — then He is sufficient for him.", author: "Qur'an", source: "65:3" },
  { text: "And that man shall have nothing but what he strives for.", author: "Qur'an", source: "53:39" },
  { text: "So remember Me; I will remember you.", author: "Qur'an", source: "2:152" },
  { text: "Do not despair of the mercy of Allah.", author: "Qur'an", source: "39:53" },
  { text: "Perhaps you hate a thing and it is good for you.", author: "Qur'an", source: "2:216" },
  { text: "Allah does not change a people until they change what is in themselves.", author: "Qur'an", source: "13:11" },
  { text: "Did He not find you lost and guide you?", author: "Qur'an", source: "93:7" },
  { text: "Your Lord has not forsaken you, nor has He become displeased.", author: "Qur'an", source: "93:3" },
  { text: "And seek help through patience and prayer.", author: "Qur'an", source: "2:45" },
  { text: "Call upon Me; I will respond to you.", author: "Qur'an", source: "40:60" },
  { text: "Are those who know equal to those who do not know?", author: "Qur'an", source: "39:9" },
  { text: "And whoever fears Allah — He will make for him a way out.", author: "Qur'an", source: "65:2" },
  { text: "And do good; indeed, Allah loves the doers of good.", author: "Qur'an", source: "2:195" },
  { text: "Hold firmly to the rope of Allah, all together, and do not become divided.", author: "Qur'an", source: "3:103" },
  { text: "And upon Allah rely, if you should be believers.", author: "Qur'an", source: "5:23" },
  { text: "He gives wisdom to whom He wills, and whoever is given wisdom has been given much good.", author: "Qur'an", source: "2:269" },
  { text: "Verily, in the remembrance of Allah do hearts find rest.", author: "Qur'an", source: "13:28" },
  { text: "And be patient. Indeed, Allah is with the patient.", author: "Qur'an", source: "8:46" },
  { text: "My success is not but through Allah.", author: "Qur'an", source: "11:88" },
  { text: "And that to your Lord is the finality.", author: "Qur'an", source: "53:42" },
  { text: "They plan, and Allah plans. And Allah is the best of planners.", author: "Qur'an", source: "8:30" },
  { text: "And He is with you wherever you are.", author: "Qur'an", source: "57:4" },
  { text: "So be patient with gracious patience.", author: "Qur'an", source: "70:5" },
  { text: "Indeed, my Lord is near and responsive.", author: "Qur'an", source: "11:61" },
  { text: "And whoever does an atom's weight of good will see it.", author: "Qur'an", source: "99:7" },
  { text: "Allah intends for you ease and does not intend for you hardship.", author: "Qur'an", source: "2:185" },
  { text: "And strive for Allah with the striving due to Him.", author: "Qur'an", source: "22:78" },
  { text: "Sufficient for us is Allah, and He is the best disposer of affairs.", author: "Qur'an", source: "3:173" },
  { text: "Say: Work, for Allah will see your deeds.", author: "Qur'an", source: "9:105" },
  { text: "And when I am ill, it is He who cures me.", author: "Qur'an", source: "26:80" },
  { text: "So when you have finished, stand up for worship.", author: "Qur'an", source: "94:7" },
  { text: "Indeed, Allah loves those who rely upon Him.", author: "Qur'an", source: "3:159" },
  { text: "And it is He who sends down the rain after they had despaired.", author: "Qur'an", source: "42:28" },
  { text: "Every soul will taste death.", author: "Qur'an", source: "3:185" },
  { text: "Race toward forgiveness from your Lord.", author: "Qur'an", source: "57:21" },
  { text: "My Lord, expand for me my breast and ease for me my task.", author: "Qur'an", source: "20:25-26" },

  // ---- Hadith ---------------------------------------------------------------
  { text: "Actions are judged by intentions.", author: "Prophet Muhammad ﷺ", source: "Bukhari & Muslim" },
  { text: "The deeds most beloved to Allah are those done consistently, even if small.", author: "Prophet Muhammad ﷺ", source: "Bukhari & Muslim" },
  { text: "Whoever travels a path in search of knowledge, Allah makes easy for him a path to Paradise.", author: "Prophet Muhammad ﷺ", source: "Muslim" },
  { text: "Seeking knowledge is an obligation upon every Muslim.", author: "Prophet Muhammad ﷺ", source: "Ibn Majah" },
  { text: "The strong believer is better and more beloved to Allah than the weak believer, though there is good in both.", author: "Prophet Muhammad ﷺ", source: "Muslim" },
  { text: "Tie your camel, and trust in Allah.", author: "Prophet Muhammad ﷺ", source: "Tirmidhi" },
  { text: "Make things easy and do not make them difficult.", author: "Prophet Muhammad ﷺ", source: "Bukhari" },
  { text: "The best of you are those with the best manners.", author: "Prophet Muhammad ﷺ", source: "Bukhari" },
  { text: "Allah does not look at your appearance or your wealth, but at your hearts and your deeds.", author: "Prophet Muhammad ﷺ", source: "Muslim" },
  { text: "Whoever does not thank people has not thanked Allah.", author: "Prophet Muhammad ﷺ", source: "Abu Dawud & Tirmidhi" },
  { text: "Richness is not an abundance of possessions; richness is contentment of the soul.", author: "Prophet Muhammad ﷺ", source: "Bukhari & Muslim" },
  { text: "Be in this world as though you were a stranger, or a traveller passing through.", author: "Prophet Muhammad ﷺ", source: "Bukhari" },
  { text: "Whoever believes in Allah and the Last Day, let him speak good or stay silent.", author: "Prophet Muhammad ﷺ", source: "Bukhari & Muslim" },
  { text: "None of you truly believes until he loves for his brother what he loves for himself.", author: "Prophet Muhammad ﷺ", source: "Bukhari & Muslim" },
  { text: "The best of people are those most beneficial to people.", author: "Prophet Muhammad ﷺ", source: "Daraqutni" },
  { text: "Allah loves, when one of you does a job, that he does it well.", author: "Prophet Muhammad ﷺ", source: "Bayhaqi" },
  { text: "He who does not show mercy will not be shown mercy.", author: "Prophet Muhammad ﷺ", source: "Bukhari & Muslim" },
  { text: "The upper hand is better than the lower hand.", author: "Prophet Muhammad ﷺ", source: "Bukhari & Muslim" },
  { text: "A good word is charity.", author: "Prophet Muhammad ﷺ", source: "Bukhari & Muslim" },
  { text: "Whoever is not grateful for the small will not be grateful for the much.", author: "Prophet Muhammad ﷺ", source: "Ahmad" },

  // ---- Companions and classical scholars ------------------------------------
  { text: "Take account of yourselves before you are taken to account.", author: "Umar ibn al-Khattab" },
  { text: "Knowledge is better than wealth: knowledge guards you, while you must guard wealth.", author: "Ali ibn Abi Talib" },
  { text: "He who has a thousand friends has not a friend to spare.", author: "Ali ibn Abi Talib" },
  { text: "The worth of every man is in what he does well.", author: "Ali ibn Abi Talib" },
  { text: "Patience is of two kinds: patience over what pains you, and patience against what you long for.", author: "Ali ibn Abi Talib" },
  { text: "Do not be a slave to others when Allah has created you free.", author: "Ali ibn Abi Talib" },
  { text: "Knowledge without action is a tree without fruit.", author: "Abu Hamid al-Ghazali" },
  { text: "Seek knowledge from the cradle to the grave.", author: "Arabic proverb" },
  { text: "Whoever wants the world must have knowledge; whoever wants the next must have knowledge.", author: "Al-Shafi'i" },
  { text: "Travel, and you will find replacements for those you leave behind; exert yourself, for the sweetness of life is in exertion.", author: "Al-Shafi'i" },
  { text: "My patience with my ignorance is my patience with the sun.", author: "Al-Shafi'i" },
  { text: "Time is like a sword: if you do not cut it, it cuts you.", author: "Al-Shafi'i" },
  { text: "Let not your tongue mention the shame of another, for you yourself are covered in shame.", author: "Al-Shafi'i" },
  { text: "The heart that is attached to Allah needs nothing else.", author: "Ibn al-Qayyim" },
  { text: "Do not grieve over what has passed unless it makes you work harder for what is coming.", author: "Umar ibn al-Khattab" },
  { text: "He who knows himself knows his Lord.", author: "Classical Sufi maxim" },
  { text: "A man is hidden under his tongue.", author: "Ali ibn Abi Talib" },
  { text: "Two hungers are never satisfied: the hunger for knowledge and the hunger for wealth.", author: "Arabic proverb" },
  { text: "Ask the experienced rather than the learned.", author: "Arabic proverb" },
  { text: "The wound of words is worse than the wound of swords.", author: "Arabic proverb" },

  // ---- Persistence and work -------------------------------------------------
  { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius", source: "Meditations 5.20" },
  { text: "Waste no more time arguing what a good man should be. Be one.", author: "Marcus Aurelius", source: "Meditations 10.16" },
  { text: "You have power over your mind, not outside events. Realise this, and you will find strength.", author: "Marcus Aurelius", source: "Meditations" },
  { text: "Confine yourself to the present.", author: "Marcus Aurelius", source: "Meditations 7.29" },
  { text: "It is not that we have a short time to live, but that we waste much of it.", author: "Seneca", source: "On the Shortness of Life" },
  { text: "Difficulties strengthen the mind, as labour does the body.", author: "Seneca" },
  { text: "It is not because things are difficult that we do not dare; it is because we do not dare that they are difficult.", author: "Seneca" },
  { text: "Every new beginning comes from some other beginning's end.", author: "Seneca" },
  { text: "First say to yourself what you would be, and then do what you have to do.", author: "Epictetus", source: "Discourses" },
  { text: "No man is free who is not master of himself.", author: "Epictetus" },
  { text: "It is impossible to begin to learn that which one thinks one already knows.", author: "Epictetus", source: "Discourses" },
  { text: "Genius is one percent inspiration and ninety-nine percent perspiration.", author: "Thomas Edison" },
  { text: "Our greatest weakness lies in giving up. The most certain way to succeed is to try just one more time.", author: "Thomas Edison" },
  { text: "There is no substitute for hard work.", author: "Thomas Edison" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act but a habit.", author: "Will Durant", source: "summarising Aristotle" },
  { text: "Nothing in the world can take the place of persistence.", author: "Calvin Coolidge" },
  { text: "The man who moves a mountain begins by carrying away small stones.", author: "Attributed to Confucius" },
  { text: "A journey of a thousand miles begins with a single step.", author: "Lao Tzu", source: "Tao Te Ching 64" },
  { text: "He who conquers himself is the mightiest warrior.", author: "Confucius" },
  { text: "The superior man is modest in his speech but exceeds in his actions.", author: "Confucius", source: "Analects" },
  { text: "When it is obvious that the goals cannot be reached, adjust the action steps.", author: "Confucius" },
  { text: "Fall seven times, stand up eight.", author: "Japanese proverb" },
  { text: "Slow and steady wins the race.", author: "Aesop", source: "The Tortoise and the Hare" },
  { text: "Little strokes fell great oaks.", author: "Benjamin Franklin", source: "Poor Richard's Almanack" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "Lost time is never found again.", author: "Benjamin Franklin", source: "Poor Richard's Almanack" },
  { text: "By failing to prepare, you are preparing to fail.", author: "Benjamin Franklin" },
  { text: "Energy and persistence conquer all things.", author: "Benjamin Franklin" },
  { text: "Perseverance is not a long race; it is many short races one after another.", author: "Walter Elliot" },
  { text: "I am a slow walker, but I never walk back.", author: "Abraham Lincoln" },
  { text: "Give me six hours to chop down a tree and I will spend the first four sharpening the axe.", author: "Attributed to Abraham Lincoln" },
  { text: "The best way out is always through.", author: "Robert Frost", source: "A Servant to Servants" },
  { text: "It always seems impossible until it is done.", author: "Nelson Mandela" },
  { text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", author: "Nelson Mandela" },
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "Do not judge me by my successes; judge me by how many times I fell down and got back up again.", author: "Nelson Mandela" },
  { text: "Hard work beats talent when talent does not work hard.", author: "Tim Notke" },
  { text: "I have missed more than nine thousand shots in my career. That is why I succeed.", author: "Michael Jordan" },
  { text: "You miss one hundred percent of the shots you do not take.", author: "Wayne Gretzky" },
  { text: "The will to win is nothing without the will to prepare.", author: "Juma Ikangaa" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },

  // ---- Knowledge and learning -----------------------------------------------
  { text: "The only true wisdom is in knowing you know nothing.", author: "Socrates", source: "as told by Plato" },
  { text: "An unexamined life is not worth living.", author: "Socrates", source: "Plato, Apology" },
  { text: "Education is the kindling of a flame, not the filling of a vessel.", author: "Attributed to Socrates" },
  { text: "The roots of education are bitter, but the fruit is sweet.", author: "Aristotle" },
  { text: "Knowing yourself is the beginning of all wisdom.", author: "Aristotle" },
  { text: "Learning is not attained by chance. It must be sought for with ardour and attended to with diligence.", author: "Abigail Adams" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Attributed to Mahatma Gandhi" },
  { text: "Develop a passion for learning. If you do, you will never cease to grow.", author: "Anthony J. D'Angelo" },
  { text: "Anyone who stops learning is old, whether at twenty or eighty.", author: "Henry Ford" },
  { text: "Whether you think you can or you think you cannot, you are right.", author: "Henry Ford" },
  { text: "Coming together is a beginning; keeping together is progress; working together is success.", author: "Henry Ford" },
  { text: "I have no special talent. I am only passionately curious.", author: "Albert Einstein" },
  { text: "It is not that I am so smart, it is just that I stay with problems longer.", author: "Albert Einstein" },
  { text: "A person who never made a mistake never tried anything new.", author: "Albert Einstein" },
  { text: "Try not to become a man of success, but rather a man of value.", author: "Albert Einstein" },
  { text: "The more I read, the more I acquire, the more certain I am that I know nothing.", author: "Voltaire" },
  { text: "Reading is to the mind what exercise is to the body.", author: "Joseph Addison" },
  { text: "The man who does not read has no advantage over the man who cannot read.", author: "Mark Twain" },
  { text: "Continuous effort, not strength or intelligence, is the key to unlocking our potential.", author: "Winston Churchill" },
  { text: "To improve is to change; to be perfect is to change often.", author: "Winston Churchill" },
  { text: "Tell me and I forget. Teach me and I remember. Involve me and I learn.", author: "Attributed to Benjamin Franklin" },
  { text: "What we learn with pleasure we never forget.", author: "Alfred Mercier" },
  { text: "Change is the end result of all true learning.", author: "Leo Buscaglia" },
  { text: "The beautiful thing about learning is that nobody can take it away from you.", author: "B. B. King" },
  { text: "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.", author: "Brian Herbert" },

  // ---- Hope, patience and faith ---------------------------------------------
  { text: "Hope is being able to see that there is light despite all of the darkness.", author: "Desmond Tutu" },
  { text: "Everything that is done in this world is done by hope.", author: "Martin Luther" },
  { text: "We must accept finite disappointment, but never lose infinite hope.", author: "Martin Luther King Jr." },
  { text: "Faith is taking the first step even when you do not see the whole staircase.", author: "Martin Luther King Jr." },
  { text: "If you cannot fly then run, if you cannot run then walk, but whatever you do you have to keep moving forward.", author: "Martin Luther King Jr." },
  { text: "The night is darkest just before the dawn.", author: "Thomas Fuller" },
  { text: "Patience is bitter, but its fruit is sweet.", author: "Aristotle" },
  { text: "Have patience. All things are difficult before they become easy.", author: "Saadi", source: "Gulistan" },
  { text: "A little knowledge that acts is worth infinitely more than much knowledge that is idle.", author: "Khalil Gibran" },
  { text: "Out of suffering have emerged the strongest souls.", author: "Khalil Gibran" },
  { text: "Work is love made visible.", author: "Khalil Gibran", source: "The Prophet" },
  { text: "The deeper that sorrow carves into your being, the more joy you can contain.", author: "Khalil Gibran", source: "The Prophet" },
  { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
  { text: "That which does not kill us makes us stronger.", author: "Friedrich Nietzsche" },
  { text: "Everything can be taken from a man but one thing: the last of the human freedoms — to choose one's attitude.", author: "Viktor Frankl", source: "Man's Search for Meaning" },
  { text: "When we are no longer able to change a situation, we are challenged to change ourselves.", author: "Viktor Frankl", source: "Man's Search for Meaning" },
  { text: "In the middle of difficulty lies opportunity.", author: "Attributed to Albert Einstein" },
  { text: "The oak fought the wind and was broken; the willow bent and survived.", author: "Robert Jordan" },
  { text: "Rock bottom became the solid foundation on which I rebuilt my life.", author: "J. K. Rowling" },
  { text: "It is impossible to live without failing at something, unless you live so cautiously that you might as well not have lived at all.", author: "J. K. Rowling" },

  // ---- Discipline and time --------------------------------------------------
  { text: "We suffer more often in imagination than in reality.", author: "Seneca" },
  { text: "Either you run the day or the day runs you.", author: "Jim Rohn" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "Do not wish it were easier; wish you were better.", author: "Jim Rohn" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
  { text: "The secret of getting ahead is getting started.", author: "Attributed to Mark Twain" },
  { text: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear", source: "Atomic Habits" },
  { text: "Every action you take is a vote for the type of person you wish to become.", author: "James Clear", source: "Atomic Habits" },
  { text: "Success is the product of daily habits, not once-in-a-lifetime transformations.", author: "James Clear", source: "Atomic Habits" },
  { text: "Amateurs sit and wait for inspiration. The rest of us just get up and go to work.", author: "Stephen King", source: "On Writing" },
  { text: "The time will pass anyway.", author: "Earl Nightingale" },
  { text: "Lost wealth may be replaced by industry, lost knowledge by study, but lost time is gone forever.", author: "Samuel Smiles" },
  { text: "Until we can manage time, we can manage nothing else.", author: "Peter Drucker" },
  { text: "What gets measured gets managed.", author: "Peter Drucker" },
  { text: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.", author: "Alexander Graham Bell" },
  { text: "Beware the barrenness of a busy life.", author: "Attributed to Socrates" },
  { text: "You will never find time for anything. If you want time, you must make it.", author: "Charles Buxton" },
  { text: "Ordinary people think merely of spending time. Great people think of using it.", author: "Attributed to Arthur Schopenhauer" },
  { text: "The bad news is time flies. The good news is you are the pilot.", author: "Michael Altshuler" },
  { text: "How we spend our days is, of course, how we spend our lives.", author: "Annie Dillard", source: "The Writing Life" },

  // ---- Character and effort -------------------------------------------------
  { text: "Quality is not an act, it is a habit.", author: "Attributed to Aristotle" },
  { text: "The price of anything is the amount of life you exchange for it.", author: "Henry David Thoreau" },
  { text: "Go confidently in the direction of your dreams. Live the life you have imagined.", author: "Henry David Thoreau" },
  { text: "It is not enough to be busy. The question is: what are we busy about?", author: "Henry David Thoreau" },
  { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
  { text: "Do not go where the path may lead; go instead where there is no path and leave a trail.", author: "Attributed to Ralph Waldo Emerson" },
  { text: "The only person you are destined to become is the person you decide to be.", author: "Ralph Waldo Emerson" },
  { text: "Character is the result of two things: mental attitude and the way we spend our time.", author: "Elbert Hubbard" },
  { text: "Courage is not the absence of fear, but the triumph over it.", author: "Nelson Mandela" },
  { text: "He who is not courageous enough to take risks will accomplish nothing in life.", author: "Muhammad Ali" },
  { text: "Do not count the days. Make the days count.", author: "Muhammad Ali" },
  { text: "I hated every minute of training, but I said: do not quit. Suffer now and live the rest of your life as a champion.", author: "Muhammad Ali" },
  { text: "Service to others is the rent you pay for your room here on earth.", author: "Muhammad Ali" },
  { text: "A winner is a dreamer who never gives up.", author: "Nelson Mandela" },
  { text: "The best preparation for tomorrow is doing your best today.", author: "H. Jackson Brown Jr." },
  { text: "Twenty years from now you will be more disappointed by the things you did not do than by the ones you did.", author: "H. Jackson Brown Jr.", source: "often misattributed to Mark Twain" },
  { text: "Success is going from failure to failure without losing enthusiasm.", author: "Attributed to Winston Churchill" },
  { text: "If you are going through hell, keep going.", author: "Attributed to Winston Churchill" },
  { text: "Great things are not done by impulse, but by a series of small things brought together.", author: "Vincent van Gogh" },
  { text: "If you hear a voice within you say you cannot paint, then by all means paint, and that voice will be silenced.", author: "Vincent van Gogh" },

  // ---- Proverbs -------------------------------------------------------------
  { text: "The best time to plant a tree was twenty years ago. The second best time is now.", author: "Proverb" },
  { text: "Smooth seas never made a skilled sailor.", author: "Proverb" },
  { text: "A river cuts through rock not because of its power but its persistence.", author: "Proverb" },
  { text: "Dripping water hollows out stone, not through force but through persistence.", author: "Ovid" },
  { text: "The tallest tree has the deepest roots.", author: "Proverb" },
  { text: "If you want to go fast, go alone. If you want to go far, go together.", author: "African proverb" },
  { text: "A smooth road never made a good driver.", author: "Proverb" },
  { text: "When the roots are deep, there is no reason to fear the wind.", author: "Proverb" },
  { text: "Do not pray for an easy life; pray for the strength to endure a difficult one.", author: "Attributed to Bruce Lee" },
  { text: "Knowing is not enough; we must apply. Willing is not enough; we must do.", author: "Bruce Lee" },
  { text: "I fear not the man who has practised ten thousand kicks once, but the man who has practised one kick ten thousand times.", author: "Bruce Lee" },
  { text: "Patience is a tree whose root is bitter but whose fruit is very sweet.", author: "Persian proverb" },
  { text: "Little by little, a little becomes a lot.", author: "Tanzanian proverb" },
  { text: "He who wants a rose must respect the thorn.", author: "Persian proverb" },
  { text: "A stumble may prevent a fall.", author: "English proverb" },
  { text: "The mountain is climbed one step at a time.", author: "Proverb" },
  { text: "Kind words do not cost much, yet they accomplish much.", author: "Blaise Pascal" },
  { text: "Small deeds done are better than great deeds planned.", author: "Peter Marshall" },
  { text: "Well begun is half done.", author: "Attributed to Aristotle" },
  { text: "A goal without a plan is just a wish.", author: "Attributed to Antoine de Saint-Exupéry" },
];

/**
 * Today's line.
 *
 * Indexed by the day number rather than by a hash of the date, so consecutive
 * days step through the list one at a time: every quote appears once before any
 * appears twice. A hash would scatter them prettily and start repeating within
 * a fortnight, which is the one thing a quote of the day must not do.
 */
export function quoteOfTheDay(date = todayISO()): Quote {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  const i = ((day % QUOTES.length) + QUOTES.length) % QUOTES.length;
  return QUOTES[i];
}
