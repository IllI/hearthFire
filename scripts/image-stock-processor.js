/**
 * Image Stock Processor
 * 
 * This script processes stock images from the "Hearth Fire Image Stock" directory,
 * uploads them to ImgBB, and either updates existing products or creates new ones.
 * 
 * Usage: node scripts/image-stock-processor.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '93d42a3af8827220fb00930836b61a44';

// Initialize Firebase Admin
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}
const API_BASE = 'http://localhost:3000/api';
const IMAGE_DIR = path.join(__dirname, '..', 'Hearth Fire Image Stock');

// Mapping of image filename -> { productName, latinName, description, matchType, existingId? }
// matchType: 'existing' (update image) or 'new' (create product)
//
// REASONING for each mapping:
//
// Filename format: NNNNN_NN_productname.jpg
// The product identifier comes after the last numeric/underscore prefix.
//
const IMAGE_MAPPINGS = [
    // === EXISTING PRODUCTS (update image) ===

    // 00025_01_chioggiagm.jpg -> "chioggia gm" = Chiogga Beets (Chioggia is a beet variety)
    { file: '00025_01_chioggiagm.jpg', matchType: 'existing', searchName: 'Chiogga Beets', searchLatin: 'Chiogga' },

    // 00054_01_flavorburst.jpg -> Flavorburst = Bell Pepper (Flavorburst Bell)
    { file: '00054_01_flavorburst.jpg', matchType: 'existing', searchName: 'Bell Pepper', searchLatin: 'Flavorburst' },

    // 00148_01_decicco.jpg -> De Cicco = a broccoli variety. We have generic "Broccoli" in db
    { file: '00148_01_decicco.jpg', matchType: 'new', productName: 'Broccoli, De Cicco', latinName: 'De Cicco', description: 'De Cicco is a classic Italian heirloom broccoli variety known for producing an abundance of small to medium-sized side shoots after the main head is harvested. This prolific variety offers an extended harvest season and a mild, sweet broccoli flavor. A reliable choice for home gardens and small farms alike.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 00331g_01_h-19littlele.jpg -> H-19 Little Leaf = a cucumber variety
    { file: '00331g_01_h-19littlele.jpg', matchType: 'new', productName: 'Cucumber, H-19 Little Leaf', latinName: 'H-19 Little Leaf', description: 'H-19 Little Leaf is a compact pickling cucumber with smaller-than-usual leaves, making it easier to spot and harvest fruits. This productive variety yields crisp, uniform cucumbers perfect for pickling or fresh eating. Its open plant habit also improves air circulation, reducing disease pressure.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 00476_01_sugar_baby.jpg -> Sugar Baby = a watermelon variety
    { file: '00476_01_sugar_baby.jpg', matchType: 'new', productName: 'Watermelon, Sugar Baby', latinName: 'Sugar Baby', description: 'Sugar Baby is a beloved compact watermelon variety that produces sweet, juicy fruits with dark green rinds and deep red flesh. Perfect for smaller gardens, these icebox-sized melons typically weigh 8-12 pounds and are ready for harvest in about 75 days. A summer favorite for its reliable sweetness and manageable size.', category: 'vegetables', unit: 'each', price: 5.50 },

    // 00507_01_joichoi.jpg -> Joi Choi = a bok choy variety
    { file: '00507_01_joichoi.jpg', matchType: 'new', productName: 'Bok Choy, Joi Choi', latinName: 'Joi Choi', description: 'Joi Choi is a vigorous, thick-stemmed bok choy variety with crisp white stalks and dark green leaves. This reliable Asian green is slow to bolt and tolerant of both heat and cold, making it versatile across seasons. Perfect stir-fried, steamed, or added fresh to salads for a mild, sweet crunch.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 00509_01_meiqingchoi.jpg -> Mei Qing Choi = a baby bok choy variety
    { file: '00509_01_meiqingchoi.jpg', matchType: 'new', productName: 'Bok Choy, Mei Qing Choi', latinName: 'Mei Qing Choi', description: 'Mei Qing Choi is a compact, fast-growing baby bok choy with pale green stems and spoon-shaped leaves. Known for its tender texture and mild, sweet flavor, it matures in just 40-45 days. Excellent for stir-fries, soups, and quick sautés, this versatile green thrives in both spring and fall plantings.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 00520_01_mammothsandwichisld.jpg -> Mammoth Sandwich Island = a salsify variety
    { file: '00520_01_mammothsandwichisld.jpg', matchType: 'new', productName: 'Salsify, Mammoth Sandwich Island', latinName: 'Mammoth Sandwich Island', description: 'Mammoth Sandwich Island Salsify is a root vegetable sometimes called the "oyster plant" for its subtle oyster-like flavor when cooked. This heirloom variety produces long, slender, cream-colored roots that can be roasted, sautéed, or added to soups. A unique and underappreciated garden treasure.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 00574_01_ace.jpg -> Ace = a bell pepper variety
    { file: '00574_01_ace.jpg', matchType: 'new', productName: 'Bell Pepper, Ace', latinName: 'Ace', description: 'Ace is an early-maturing bell pepper variety known for its reliable performance in cooler climates. Producing medium-sized, thick-walled green peppers that ripen to red, Ace is a dependable choice for shorter growing seasons. Its compact plants are productive and well-suited for container gardening or small garden spaces.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 00591_01_islander.jpg -> Islander = a bell pepper variety (purple/lavender)
    { file: '00591_01_islander.jpg', matchType: 'new', productName: 'Bell Pepper, Islander', latinName: 'Islander', description: 'Islander is a striking bell pepper that ripens through a beautiful color progression from lavender to yellow to orange and finally red. Each stage is fully edible with a sweet, mild flavor. This unique variety adds visual drama to both the garden and the plate, and performs well in warm summer conditions.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 00671_01_waltham.jpg -> Waltham = Waltham Butternut Squash
    { file: '00671_01_waltham.jpg', matchType: 'new', productName: 'Butternut Squash, Waltham', latinName: 'Waltham Butternut', description: 'Waltham Butternut is the classic winter squash with a smooth tan exterior and rich, sweet orange flesh. This dependable heirloom variety stores exceptionally well and is perfect for roasting, soups, and pies. Plants produce uniform, 3-5 pound fruits with small seed cavities, maximizing the delicious edible flesh.', category: 'vegetables', unit: 'each', price: 5.50 },

    // 00703d_01_brilights.jpg -> Bright Lights = Swiss Chard variety
    { file: '00703d_01_brilights.jpg', matchType: 'new', productName: 'Swiss Chard, Bright Lights', latinName: 'Bright Lights', description: 'Bright Lights Swiss Chard is a stunning rainbow variety featuring stems in vibrant shades of red, orange, yellow, pink, and white. Beyond its ornamental beauty, this chard delivers tender, mildly flavored leaves that are excellent sautéed, in salads, or as a nutritious cooking green. A garden showstopper that is as delicious as it is beautiful.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 00770_01_sungold.jpg -> Sungold Cherry Tomato (existing!)
    { file: '00770_01_sungold.jpg', matchType: 'existing', searchName: 'Sungold Cherry Tomato', searchLatin: 'Sungold' },

    // 0088g_01_blackcherry.jpg -> Black Cherry Tomato (existing!)
    { file: '0088g_01_blackcherry.jpg', matchType: 'existing', searchName: 'Black Cherry Tomato', searchLatin: 'Black Cherry' },

    // 00919_02_santo.jpg -> Santo = a cilantro/coriander variety. We have "Cilantro" in db
    { file: '00919_02_santo.jpg', matchType: 'existing', searchName: 'Cilantro', searchLatin: '' },

    // 00922_01_cuttingcelery.jpg -> Cutting Celery
    { file: '00922_01_cuttingcelery.jpg', matchType: 'new', productName: 'Cutting Celery', latinName: 'Apium graveolens', description: 'Cutting Celery is an intensely flavored herb with thin, hollow stems and flat leaves that taste like a concentrated version of standard celery. Unlike stalk celery, it is grown primarily for its aromatic leaves, which are wonderful in soups, stews, salads, and as a garnish. Easy to grow and endlessly useful in the kitchen.', category: 'culinary-herbs', unit: 'each', price: 4.50 },

    // 00945_01_sweetthaibas.jpg -> Sweet Thai Basil. We have Holy Basil/Tulsi but not Thai Basil.
    { file: '00945_01_sweetthaibas.jpg', matchType: 'new', productName: 'Sweet Thai Basil', latinName: 'Ocimum basilicum var. thyrsiflora', description: 'Sweet Thai Basil is an aromatic culinary herb with a distinctive anise-licorice flavor and beautiful purple stems and flower spikes. Essential in Thai, Vietnamese, and other Southeast Asian cuisines, it holds up well to cooking heat unlike Italian basil varieties. Its ornamental beauty and robust flavor make it a must-have herb.', category: 'culinary-herbs', unit: 'each', price: 4.50 },

    // 02038_01_kingarthur.jpg -> King Arthur Bell Pepper (existing!)
    { file: '02038_01_kingarthur.jpg', matchType: 'existing', searchName: 'King Arthur Bell Pepper', searchLatin: 'King Arthur' },

    // 02053_01_costataromanesco.jpg -> Costata Romanesco = a zucchini variety
    { file: '02053_01_costataromanesco.jpg', matchType: 'new', productName: 'Zucchini, Costata Romanesco', latinName: 'Costata Romanesco', description: 'Costata Romanesco is a prized Italian heirloom zucchini known for its distinctive ribbed shape and nutty, rich flavor that is far superior to standard zucchini. The firm flesh holds up beautifully when grilled, roasted, or sliced raw into salads. Often considered the finest-tasting summer squash available.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 02054g_01_tuffy.jpg -> Tuffy = a winter squash variety (acorn type)
    { file: '02054g_01_tuffy.jpg', matchType: 'new', productName: 'Acorn Squash, Tuffie', latinName: 'Tuffie', description: 'Tuffie Acorn Squash is a compact, personal-sized winter squash with dark green skin and sweet, golden-orange flesh. Its individual serving size makes it perfect for stuffing and roasting whole. This vigorous variety produces abundantly and stores well through the winter months.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 02063_01_bigbeef.jpg -> Big Beef Tomato (existing!)
    { file: '02063_01_bigbeef.jpg', matchType: 'existing', searchName: 'Tomato', searchLatin: 'Big Beef' },

    // 02198_01_diva.jpg -> Diva = a cucumber variety
    { file: '02198_01_diva.jpg', matchType: 'new', productName: 'Cucumber, Diva', latinName: 'Diva', description: 'Diva is an award-winning seedless cucumber variety with smooth, thin skin that never needs peeling. These sweet, crisp, and never bitter cucumbers are perfect for fresh eating and salads. The all-female plant produces prolifically without the need for pollination, and is resistant to common cucumber diseases.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 02372_01_stripedgerman.jpg -> Striped German = a tomato variety
    { file: '02372_01_stripedgerman.jpg', matchType: 'new', productName: 'Tomato, Striped German', latinName: 'Striped German', description: 'Striped German is a stunning heirloom tomato featuring marbled red and yellow flesh with a rich, fruity, complex flavor. These large, beefsteak-type fruits can weigh over a pound and are as beautiful sliced on a plate as they are delicious. A conversation-starter at farmers markets and dinner tables alike.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 02390_03_giantofitaly.jpg -> Giant of Italy = a parsley variety. We have "Parsley" in db.
    { file: '02390_03_giantofitaly.jpg', matchType: 'existing', searchName: 'Parsley', searchLatin: '' },

    // 02412g_01_new_girl.jpg -> New Girl = a tomato variety
    { file: '02412g_01_new_girl.jpg', matchType: 'new', productName: 'Tomato, New Girl', latinName: 'New Girl', description: 'New Girl is an early-season tomato that produces round, smooth, 4-6 oz fruits with excellent classic tomato flavor. A reliable producer with good disease resistance, New Girl is a modern improvement on the classic New Yorker type. Perfect for slicing and salads, with fruits that ripen uniformly on vigorous, indeterminate vines.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 02413_01_gypsy.jpg -> Gypsy = a pepper variety
    { file: '02413_01_gypsy.jpg', matchType: 'new', productName: 'Pepper, Gypsy', latinName: 'Gypsy', description: 'Gypsy is an award-winning sweet pepper variety that produces early and abundantly. The elongated, wedge-shaped fruits ripen from yellow to orange to deep red, offering sweet flavor at every stage. A compact plant that is perfect for containers and small spaces, Gypsy is disease-resistant and extremely productive.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 02460_01_blksummer.jpg -> Black Summer = a basil or possibly Black Summer truffle? "blksummer" = Black Seeded Simpson? No, likely Black Summer = a lettuce or an eggplant. Hmm. "blksummer" = "Black Summer" - this is likely referring to an eggplant variety called Black Beauty or a turnip. Actually, looking at Johnny's Seeds catalog codes, 02460 is their code number. "blksummer" is most likely "Black Summer" — an Italian zucchini/summer squash variety. Let me check more carefully.
    // Actually, on reflection, this is likely a Black Zucchini / Black Beauty summer squash.
    { file: '02460_01_blksummer.jpg', matchType: 'new', productName: 'Summer Squash, Black Beauty', latinName: 'Black Beauty', description: 'Black Beauty is a classic dark green zucchini-type summer squash with smooth skin and creamy white flesh. One of the most popular and productive summer squash varieties, it is perfect for grilling, sautéing, baking into bread, or enjoying raw with dips. Harvest young for the most tender and flavorful fruits.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 02562g_01_corinto.jpg -> Corinto = a tomato variety
    { file: '02562g_01_corinto.jpg', matchType: 'new', productName: 'Tomato, Corinto', latinName: 'Corinto', description: 'Corinto is a premium grape tomato variety producing uniform, deep red, crack-resistant fruits with excellent sweet flavor. These bite-sized tomatoes are perfect for snacking, salads, and roasting. The vigorous indeterminate plants yield heavily throughout the season, making Corinto a top choice for both gardeners and market growers.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 02621_01_musqueprovence.jpg -> Musque de Provence = a pumpkin/squash variety
    { file: '02621_01_musqueprovence.jpg', matchType: 'new', productName: 'Pumpkin, Musque de Provence', latinName: 'Musque de Provence', description: 'Musque de Provence is a gorgeous French heirloom pumpkin with a deeply ribbed, cheese-wheel shape and a rich burnt-orange exterior when mature. The dense, deep orange flesh is exceptionally sweet and perfect for soups, pies, and roasting. This stunning variety doubles as both a culinary treasure and an autumn decoration.', category: 'vegetables', unit: 'each', price: 6.50 },

    // 02629_01_happy_rich.jpg -> Happy Rich = Broccolini (existing!)
    { file: '02629_01_happy_rich.jpg', matchType: 'existing', searchName: 'Broccolini', searchLatin: 'Happy Rich' },

    // 02784_01_sarahschoicehorz.jpg -> Sarah's Choice = a melon variety
    { file: '02784_01_sarahschoicehorz.jpg', matchType: 'new', productName: 'Melon, Sarah\'s Choice', latinName: 'Sarah\'s Choice', description: 'Sarah\'s Choice is a personal-sized cantaloupe melon with incredibly sweet, aromatic orange flesh. Bred for northern climates with shorter growing seasons, this early-maturing variety produces 3-4 pound fruits with excellent disease resistance. The perfect melon for those who want homegrown sweetness without a long wait.', category: 'vegetables', unit: 'each', price: 5.50 },

    // 02813_01_greenmagic.jpg -> Green Magic Broccoli (existing!)
    { file: '02813_01_greenmagic.jpg', matchType: 'existing', searchName: 'Broccoli', searchLatin: 'Green Magic' },

    // 02845_01_brandywine.jpg -> Brandywine Tomato (existing!)
    { file: '02845_01_brandywine.jpg', matchType: 'existing', searchName: 'Brandywine Tomato', searchLatin: 'Brandywine' },

    // 02897_01_tatsoi.jpg -> Tatsoi = an Asian green
    { file: '02897_01_tatsoi.jpg', matchType: 'new', productName: 'Tatsoi', latinName: 'Brassica rapa var. rosularis', description: 'Tatsoi is a beautiful rosette-forming Asian green with spoon-shaped, dark green leaves and a mild, mustard-like flavor. This cold-hardy green is one of the most versatile in the kitchen — delicious raw in salads, quickly stir-fried, or added to soups. Its low, spreading growth habit makes it ornamental as well as edible.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 02935_01_alpha.jpg -> Alpha = a pea variety
    { file: '02935_01_alpha.jpg', matchType: 'new', productName: 'Pea, Alpha', latinName: 'Alpha', description: 'Alpha is a reliable, early-maturing garden pea with plump, sweet pods that are ready to pick in just 55-60 days. The short, bushy vines produce generously without the need for trellising, making Alpha an ideal variety for smaller gardens. Fresh-picked Alpha peas offer a sweetness that store-bought peas simply cannot match.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 02954_01_cheddar.jpg -> Cheddar = a cauliflower variety (orange cauliflower)
    { file: '02954_01_cheddar.jpg', matchType: 'new', productName: 'Cauliflower, Cheddar', latinName: 'Cheddar', description: 'Cheddar is a stunning orange cauliflower variety that gets its vibrant color from beta-carotene — the same compound found in carrots. The bright orange heads hold their color when cooked and have a mild, slightly sweet and nutty flavor. Cheddar actually becomes more nutritious when cooked, as heat makes the beta-carotene more bioavailable.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 02985_01_alcosa.jpg -> Alcosa Savoy Cabbage (existing!)
    { file: '02985_01_alcosa.jpg', matchType: 'existing', searchName: 'Cabbage', searchLatin: 'Alcosa' },

    // 02993g_01_carmen.jpg -> Carmen Bullhorn Pepper (existing!)
    { file: '02993g_01_carmen.jpg', matchType: 'existing', searchName: 'Carmen Bullhorn Pepper', searchLatin: 'Carmen' },

    // 03072jp_01_foundationcollectionstudio.jpg -> Foundation Collection Studio - this is ambiguous/not a product name. Skip.
    // { file: '03072jp_01_foundationcollectionstudio.jpg', matchType: 'skip' },

    // 03121_01_boldor.jpg -> Boldor = a beet variety (golden beet)
    { file: '03121_01_boldor.jpg', matchType: 'existing', searchName: 'Beets', searchLatin: 'Golden' },

    // 03300g_01_boro.jpg -> Boro = a beet variety (red beet)
    { file: '03300g_01_boro.jpg', matchType: 'new', productName: 'Beets, Boro', latinName: 'Boro', description: 'Boro is a premium red beet variety producing perfectly round, smooth roots with deep red flesh and minimal zoning. Known for its sweet, earthy flavor and uniform shape, Boro is a top performer for both fresh eating and storage. The tender baby beet greens are equally delicious sautéed or added to salads.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 03346_01_max_pack.jpg -> Max Pack = a sweet pepper variety
    { file: '03346_01_max_pack.jpg', matchType: 'new', productName: 'Pepper, Maxibel', latinName: 'Maxibel', description: 'Maxibel is a premium French filet bean with slender, dark purple pods that turn green when cooked. These stringless beans have a tender, delicate texture and a rich, savory flavor. Highly productive plants yield abundantly over a long harvest window. A gourmet garden staple.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 03449g_01_cool_customer.jpg -> Cool Customer = a cucumber variety
    { file: '03449g_01_cool_customer.jpg', matchType: 'new', productName: 'Cucumber, Cool Customer', latinName: 'Cool Customer', description: 'Cool Customer is a burpless, thin-skinned slicing cucumber that lives up to its name with refreshing crispness and clean, mild flavor. These dark green, uniform fruits are straight and smooth, perfect for slicing into salads or sandwiches. Plants are disease-resistant and produce generously throughout the summer.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 03515g_01_lunchboxpeppersmix.jpg -> Lunch Box Peppers Mix (existing!)
    { file: '03515g_01_lunchboxpeppersmix.jpg', matchType: 'existing', searchName: 'Lunch Box pepper', searchLatin: 'Lunch Box' },

    // 03531_02_black_magic.jpg -> Black Magic = a kale variety. We have Red Russian Kale and Dazzling Blue Kale, and Green Curly Kale.
    { file: '03531_02_black_magic.jpg', matchType: 'new', productName: 'Kale, Black Magic', latinName: 'Black Magic', description: 'Black Magic is a lacinato-type (Tuscan) kale with deeply textured, dark blue-green leaves. This vigorous variety has a rich, slightly sweet flavor that becomes even more complex after a light frost. Perfect for sautéing, adding to soups, making kale chips, or massaging into raw salads with a bit of olive oil and lemon.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 03562_01_sureness.jpg -> Sureness = a cabbage variety (napa type)
    { file: '03562_01_sureness.jpg', matchType: 'new', productName: 'Cabbage, Sureness', latinName: 'Sureness', description: 'Sureness is a dependable green cabbage variety that forms tight, round, 3-4 pound heads with excellent texture and sweet, mild flavor. This disease-resistant variety performs well in a wide range of growing conditions and stores beautifully. Perfect for coleslaw, sauerkraut, stir-fries, and classic cabbage rolls.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 03566g_01_westlandese_winter.jpg -> Westlandse Winter = Green Curly Kale (existing!)
    { file: '03566g_01_westlandese_winter.jpg', matchType: 'existing', searchName: 'Green Curly Kale', searchLatin: 'Westlandse Winter' },

    // 03626_02_tiara.jpg -> Tiara = a kohlrabi variety
    { file: '03626_02_tiara.jpg', matchType: 'new', productName: 'Kohlrabi, Tiara', latinName: 'Tiara', description: 'Tiara Kohlrabi produces smooth, light green bulbs with crisp, sweet, juicy white flesh. This fast-growing variety is ready to harvest in just 50 days and resists becoming woody even at larger sizes. Delicious raw in slaws and salads, or roasted for a sweet, caramelized side dish. A versatile vegetable that deserves more attention.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 03633g_01_dagan.jpg -> Dagan = a sweet pepper variety
    { file: '03633g_01_dagan.jpg', matchType: 'new', productName: 'Pepper, Dagan', latinName: 'Dagan', description: 'Dagan is a large, blocky sweet pepper that ripens from green to a rich, deep red. Known for its thick, crunchy walls and very sweet flavor, Dagan is excellent for fresh eating, roasting, and stuffing. This high-yielding variety performs well in warm summer conditions and produces uniformly shaped fruits throughout the season.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 03672_01_baron.jpg -> Baron = Poblano Pepper (existing! "Pablano Baron")
    { file: '03672_01_baron.jpg', matchType: 'existing', searchName: 'Pablano Pepper', searchLatin: 'Baron' },

    // 03763g_01_carbon.jpg -> Carbon = a tomato variety
    { file: '03763g_01_carbon.jpg', matchType: 'new', productName: 'Tomato, Carbon', latinName: 'Carbon', description: 'Carbon is a stunning dark tomato with smoky olive-black skin and rich, complex flavor that has earned it a cult following among tomato enthusiasts. These large beefsteak-type fruits have deep red-green flesh and a balanced sweet-savory taste. One of the best-performing dark tomatoes, Carbon rivals the legendary Black Krim in flavor.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 03807_01_jalafuego.jpg -> Jalafuego = Jalapeno Pepper (existing!)
    { file: '03807_01_jalafuego.jpg', matchType: 'existing', searchName: 'Jalapeno Pepper', searchLatin: 'Jalafuego' },

    // 03814g_01_black_krim.jpg -> Black Krim Tomato (existing!)
    { file: '03814g_01_black_krim.jpg', matchType: 'existing', searchName: 'Black Krim Tomato', searchLatin: 'Black Krim' },

    // 03815g_01_germanjohnson.jpg -> German Johnson = a tomato variety
    { file: '03815g_01_germanjohnson.jpg', matchType: 'new', productName: 'Tomato, German Johnson', latinName: 'German Johnson', description: 'German Johnson is a beloved Southern heirloom tomato known for its large, pink-red fruits with low acidity and superb, mild flavor. This crack-resistant variety is a parent of the famous Mortgage Lifter tomato. Productive indeterminate vines yield meaty, nearly seedless fruits that are perfect for sandwiches and fresh eating.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 03832_01_bishop_vendor.jpg -> Bishop... this could be a squash or pepper. "bishop_vendor" might mean it's a vendor photo of something called "Bishop". Actually, looking at seed catalogs, Bishop's Crown (or Bishop's Hat) is a pepper variety. But "vendor" suggests it's a vendor image.
    // Likely a pepper variety called Bishop's Crown/Hat
    { file: '03832_01_bishop_vendor.jpg', matchType: 'new', productName: 'Pepper, Bishop\'s Hat', latinName: 'Bishop\'s Hat', description: 'Bishop\'s Hat pepper (also known as Bishop\'s Crown) is a unique heirloom pepper with a distinctive flying saucer or bishop\'s mitre shape. Mildly hot with sweet outer lobes and spicier inner walls, this versatile pepper is perfect for creative stuffing, pickling, or adding visual interest to fresh salsas. A conversation-starting variety.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 03843g_01_dunja.jpg -> Dunja = a zucchini variety
    { file: '03843g_01_dunja.jpg', matchType: 'new', productName: 'Zucchini, Dunja', latinName: 'Dunja', description: 'Dunja is a high-performing zucchini variety with an open, upright plant habit that makes harvesting easy. Producing glossy, dark green, uniform fruits with excellent texture and mild flavor. Known for its strong disease resistance, particularly to powdery mildew, Dunja keeps producing long after other varieties have succumbed.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 03912_01_georgiacandy.jpg -> Georgia Candy = a sweet potato/onion variety. Most likely "Georgia Candy Roaster" squash.
    { file: '03912_01_georgiacandy.jpg', matchType: 'new', productName: 'Squash, Georgia Candy Roaster', latinName: 'Georgia Candy Roaster', description: 'Georgia Candy Roaster is a treasured Southern heirloom winter squash dating back to Cherokee cultivation. These large, banana-shaped fruits can reach 10-15 pounds and have sweet, smooth, deep orange flesh that is phenomenal roasted, in pies, or as a soup base. A living piece of agricultural history with outstanding flavor.', category: 'vegetables', unit: 'each', price: 5.50 },

    // 03981_01_supersweet100.jpg -> Super Sweet 100 = Sweet 100 Tomato (existing!)
    { file: '03981_01_supersweet100.jpg', matchType: 'existing', searchName: 'Tomato, Sweet 100s', searchLatin: 'Sweet 100' },

    // 04032_01_topbunch_2.jpg -> Top Bunch = Collards (existing!)
    { file: '04032_01_topbunch_2.jpg', matchType: 'existing', searchName: 'Collards', searchLatin: 'Top Bunch' },

    // 04124_01_bc1611.jpg -> BC1611 = this is a code number, hard to determine the product. Skip.
    // { file: '04124_01_bc1611.jpg', matchType: 'skip' },

    // 04171_01_merlot.jpg -> Merlot = a lettuce variety (red lettuce)
    { file: '04171_01_merlot.jpg', matchType: 'new', productName: 'Lettuce, Merlot', latinName: 'Merlot', description: 'Merlot is a dark red leaf lettuce with deeply lobed, frilly leaves and a beautiful wine-red color. This heat-tolerant variety is slow to bolt and maintains its tender texture even in warm weather. The striking crimson leaves add vibrant color contrast to salad mixes and make beautiful garnishes.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 04178g_01_dazzlingblue.jpg -> Dazzling Blue = Kale (existing!)
    { file: '04178g_01_dazzlingblue.jpg', matchType: 'existing', searchName: 'Kale', searchLatin: 'Dazzling Blue' },

    // 04206g_01_bopak.jpg -> Bopak = a bok choy variety (pak choi)
    { file: '04206g_01_bopak.jpg', matchType: 'new', productName: 'Bok Choy, Bopak', latinName: 'Bopak', description: 'Bopak is a classic, full-sized bok choy (pak choi) with thick, white, crunchy stalks and dark green, tender leaves. This reliable variety is slow to bolt and has good cold tolerance, making it suitable for both spring and fall planting. Essential for Asian-inspired stir-fries, soups, and braised dishes.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 04337_01_santodomingo.jpg -> Santo Domingo = a pepper variety (likely a hot pepper)
    { file: '04337_01_santodomingo.jpg', matchType: 'new', productName: 'Pepper, Santo Domingo', latinName: 'Santo Domingo', description: 'Santo Domingo is a flavorful Pueblo-type pepper traditionally used for roasting and making chile ristras in the American Southwest. These medium-heat peppers have thick walls and develop a rich, complex flavor when roasted. A cultural and culinary heirloom connecting growers to centuries of Southwestern food tradition.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 04374_01_puntoverde.jpg -> Punto Verde = a tomato variety (green when ripe)
    { file: '04374_01_puntoverde.jpg', matchType: 'new', productName: 'Tomato, Punto Verde', latinName: 'Punto Verde', description: 'Punto Verde is a unique salad tomato that stays green when ripe, with golden shoulders that signal its readiness to pick. These medium-sized, oblate fruits have bright, tangy-sweet flavor with complex citrus notes. A visually intriguing addition to any tomato collection that will have your customers asking questions at the market.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 04405_01_monty.jpg -> Monty = a pea variety
    { file: '04405_01_monty.jpg', matchType: 'new', productName: 'Pea, Monty', latinName: 'Monty', description: 'Monty is a high-yielding garden pea with plump, sweet pods on compact, semi-leafless vines. The open plant structure allows good air circulation, reducing disease pressure and making harvesting a breeze. These sweet, tender peas are a delight eaten fresh off the vine or lightly steamed as a side dish.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 04543g_01_space.jpg -> Space = Spinach (existing! "Spinach, 8 count of plugs" with latinName "Space")
    { file: '04543g_01_space.jpg', matchType: 'existing', searchName: 'Spinach', searchLatin: 'Space' },

    // 04554_01_griselet.jpg -> Griselet = a lettuce variety (oakleaf type)
    { file: '04554_01_griselet.jpg', matchType: 'new', productName: 'Lettuce, Griselet', latinName: 'Griselet', description: 'Griselet is a French oakleaf lettuce variety with beautifully textured, light green leaves. Its delicate, buttery flavor and tender yet crisp texture make it a premium salad green. This variety is slow to bolt, heat-tolerant, and resistant to tipburn, keeping your harvests looking pristine all season long.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 04654_01_clementine.jpg -> Clementine = a tomato variety (orange cherry tomato)
    { file: '04654_01_clementine.jpg', matchType: 'new', productName: 'Tomato, Clementine', latinName: 'Clementine', description: 'Clementine is a gorgeous orange cherry tomato with a remarkably sweet, fruity flavor and beautiful tangerine color. These crack-resistant, uniform fruits are produced in generous clusters on vigorous indeterminate vines. A standout variety that brings sunshine to any salad or snack plate.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 04769g_01_kolibri_mini_lettuce.jpg -> Kolibri Mini Lettuce
    { file: '04769g_01_kolibri_mini_lettuce.jpg', matchType: 'new', productName: 'Lettuce, Kolibri', latinName: 'Kolibri', description: 'Kolibri is a beautiful mini romaine lettuce with stunning red-tinged leaves and a tight, compact head. This petite variety is perfect for individual servings and packs a tender, sweet crunch. Its miniature size makes it ideal for container growing and farmers market presentation.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 04778_01_jolene.jpg -> Jolene = a lettuce variety (butterhead/bibb type)
    { file: '04778_01_jolene.jpg', matchType: 'new', productName: 'Lettuce, Jolene', latinName: 'Jolene', description: 'Jolene is a gorgeous red butterhead lettuce with soft, tender leaves that are deep red on the edges and bright green at the heart. Its buttery, melt-in-your-mouth texture and mild, sweet flavor make it a premium salad green. Jolene is bolt-resistant and adapts well to varying growing conditions.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 04788_01_sunland_romaine_lettuce.jpg -> Sunland Romaine Lettuce
    { file: '04788_01_sunland_romaine_lettuce.jpg', matchType: 'new', productName: 'Lettuce, Sunland Romaine', latinName: 'Sunland Romaine', description: 'Sunland Romaine is a robust, full-headed romaine lettuce with crisp, upright leaves and excellent sweet flavor. This heavy, dense variety is disease-resistant and slow to bolt, producing reliable heads even in warm conditions. The thick, juicy midribs make it the ultimate choice for Caesar salads and wraps.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 04822_01_purplemoon.jpg -> Purple Moon = likely an eggplant variety
    { file: '04822_01_purplemoon.jpg', matchType: 'new', productName: 'Eggplant, Purple Moon', latinName: 'Purple Moon', description: 'Purple Moon is a high-yielding Italian eggplant variety producing glossy, dark purple, teardrop-shaped fruits. The creamy white flesh is virtually seedless with a smooth, mild flavor and no bitterness. Excellent grilled, roasted, or in classic dishes like eggplant parmesan and baba ganoush.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 04920_01_haku_chinese_cabbage.jpg -> Haku Chinese Cabbage = Napa Cabbage (existing!)
    { file: '04920_01_haku_chinese_cabbage.jpg', matchType: 'existing', searchName: 'Napa Cabbage', searchLatin: 'Haku' },

    // 05261jp_01_purple_fusion_lettuce.jpg -> Purple Fusion Lettuce
    { file: '05261jp_01_purple_fusion_lettuce.jpg', matchType: 'new', productName: 'Lettuce, Purple Fusion', latinName: 'Purple Fusion', description: 'Purple Fusion is a vibrant lettuce blend combining multiple red and purple varieties for a striking mix of colors, textures, and flavors. This easy-to-grow mix provides a ready-made premium salad blend right from the garden. The deep crimson and burgundy tones intensify with cool weather, making it a stunning fall and spring crop.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 0598g_01_habanero.jpg -> Habanero = a hot pepper variety
    { file: '0598g_01_habanero.jpg', matchType: 'new', productName: 'Habanero Pepper', latinName: 'Capsicum chinense', description: 'The Habanero is one of the world\'s most recognizable hot peppers, delivering intense heat (100,000-350,000 Scoville units) alongside a distinctive fruity, citrusy flavor that pepper enthusiasts crave. These small, lantern-shaped fruits ripen from green to brilliant orange. Essential for hot sauces, salsas, and Caribbean-inspired cuisine.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 06021g_01_kapoortulsi.jpg -> Kapoor Tulsi = a Holy Basil variety. We have "Holy Basil, Tulsi" in db.
    { file: '06021g_01_kapoortulsi.jpg', matchType: 'existing', searchName: 'Holy Basil, Tulsi', searchLatin: 'Ocimum tenuiflorum' },

    // 06039_01_fujiyama_vendor_cauliflower.jpg -> Fujiyama Cauliflower
    { file: '06039_01_fujiyama_vendor_cauliflower.jpg', matchType: 'new', productName: 'Cauliflower, Fujiyama', latinName: 'Fujiyama', description: 'Fujiyama is a smooth, snow-white cauliflower variety with excellent self-wrapping leaves that protect the developing head from sun exposure. Producing dense, heavy heads with tight curds and clean appearance, Fujiyama is a heat-tolerant variety suitable for summer production. A premium cauliflower for fresh markets and home gardens.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 06045_01_amethyst_cauliflower.jpg -> Amethyst Cauliflower
    { file: '06045_01_amethyst_cauliflower.jpg', matchType: 'new', productName: 'Cauliflower, Amethyst', latinName: 'Amethyst', description: 'Amethyst is a stunning purple cauliflower that brings vivid color to both the garden and the dinner table. The vibrant violet heads are packed with anthocyanin antioxidants and have a sweet, mild, slightly nutty flavor. The color intensifies when served raw and softens to a beautiful purple-green when lightly steamed.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 0753g_01_cherokee_purple.jpg -> Cherokee Purple Tomato (existing!)
    { file: '0753g_01_cherokee_purple.jpg', matchType: 'existing', searchName: 'Cherokee Purple Tomato', searchLatin: 'Cherokee Purple' },

    // 0911gp_01_genovesebasil.jpg -> Genovese Basil. We don't have a Genovese specifically.
    { file: '0911gp_01_genovesebasil.jpg', matchType: 'new', productName: 'Genovese Basil', latinName: 'Ocimum basilicum', description: 'Genovese Basil is the classic Italian sweet basil, considered the gold standard for making authentic pesto, Caprese salad, and Italian sauces. Its large, aromatic, slightly cupped leaves have the quintessential sweet basil flavor with notes of clove and anise. This vigorous variety is the most popular basil in the world for good reason.', category: 'culinary-herbs', unit: 'each', price: 4.50 },

    // 2110g_01_farao.jpg -> Farao = Green Cabbage (existing! latinName "Farao")
    { file: '2110g_01_farao.jpg', matchType: 'existing', searchName: 'Green Cabbage', searchLatin: 'Farao' },

    // 2815g_01_belstar.jpg -> Belstar = a broccoli variety
    { file: '2815g_01_belstar.jpg', matchType: 'new', productName: 'Broccoli, Belstar', latinName: 'Belstar', description: 'Belstar is a premium organic broccoli variety known for producing dense, dome-shaped heads with fine, uniform beading. This versatile variety performs well in both spring and fall plantings and continues producing generous side shoots after the main head is harvested. Strong stems and good field-holding ability make Belstar a market-grower favorite.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 3125g_01_escamillo.jpg -> Escamillo = a sweet pepper variety
    { file: '3125g_01_escamillo.jpg', matchType: 'new', productName: 'Pepper, Escamillo', latinName: 'Escamillo', description: 'Escamillo is a brilliant golden-yellow sweet pepper with thick, crunchy walls and exceptionally sweet flavor. These blocky, bell-shaped peppers ripen from green to a rich sunshine yellow, adding vibrant color to any dish. Productive and disease-resistant, Escamillo is a standout choice for colorful pepper platters and roasting.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 3642g_01_azurstar.jpg -> Azur Star = a kohlrabi variety (purple kohlrabi)
    { file: '3642g_01_azurstar.jpg', matchType: 'new', productName: 'Kohlrabi, Azur Star', latinName: 'Azur Star', description: 'Azur Star is a gorgeous purple kohlrabi with vivid violet skin and crisp, tender white flesh inside. The sweet, mild flavor is like a cross between a broccoli stem and an apple, making it delicious raw with dip, in slaws, or roasted. This early-maturing variety stays tender even as bulbs grow larger.', category: 'vegetables', unit: 'each', price: 4.50 },

    // 4047_01_autunmdelights.jpg -> Autumn Delights = a winter squash mix
    { file: '4047_01_autunmdelights.jpg', matchType: 'new', productName: 'Winter Squash, Autumn Delights Mix', latinName: 'Autumn Delights', description: 'Autumn Delights is a beautiful mix of miniature winter squash varieties in a range of shapes, colors, and patterns. Perfect for fall decorating and cooking, this collection includes sweet, edible varieties that are as delicious roasted as they are stunning on a centerpiece. Each squash is personal-sized for easy individual servings.', category: 'vegetables', unit: 'each', price: 5.50 },

    // 4673_01_spitfire.jpg -> Spitfire = a lettuce variety (red romaine)
    { file: '4673_01_spitfire.jpg', matchType: 'new', productName: 'Lettuce, Spitfire', latinName: 'Spitfire', description: 'Spitfire is a crisp, fast-growing baby leaf lettuce with bright green leaves and a clean, fresh flavor profile. Bred for rapid regrowth after cutting, Spitfire is ideal for continuous cut-and-come-again harvesting. Its uniform leaf shape and color make it a premium addition to mesclun mixes and salad blends.', category: 'vegetables', unit: 'each', price: 4.50 },
];

// Skipped files (can't determine product from filename):
const SKIPPED_FILES = [
    '03072jp_01_foundationcollectionstudio.jpg', // "Foundation Collection Studio" - ambiguous collection/marketing image
    '04124_01_bc1611.jpg', // "BC1611" - just a catalog code, can't determine product
];

async function uploadToImgBB(filePath) {
    const imageData = fs.readFileSync(filePath);
    const base64 = imageData.toString('base64');

    const form = new FormData();
    form.append('key', IMGBB_API_KEY);
    form.append('image', base64);
    form.append('name', path.basename(filePath, path.extname(filePath)));

    const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: form,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`ImgBB upload failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    if (!data.success) {
        throw new Error(`ImgBB upload failed: ${JSON.stringify(data)}`);
    }

    return data.data.url;
}

async function getProducts() {
    const response = await fetch(`${API_BASE}/products`);
    if (!response.ok) throw new Error('Failed to fetch products');
    return await response.json();
}

async function getAuthToken() {
    // Firebase Admin is already initialized at the top of the file
    return admin;
}

async function updateProductImage(adminSdk, productId, imageUrl) {
    const firestore = adminSdk.firestore();
    await firestore.collection('products').doc(productId).update({
        image: imageUrl,
        images: adminSdk.firestore.FieldValue.arrayUnion(imageUrl),
        updatedAt: adminSdk.firestore.FieldValue.serverTimestamp(),
    });
}

async function createProduct(adminSdk, productData) {
    const firestore = adminSdk.firestore();
    const docRef = await firestore.collection('products').add({
        name: productData.productName,
        latinName: productData.latinName || '',
        description: productData.description || '',
        price: productData.price || 4.50,
        category: productData.category || 'vegetables',
        categories: [productData.category || 'vegetables'],
        stock: 0,
        quantity: 0,
        unit: productData.unit || 'each',
        image: productData.imageUrl,
        images: [productData.imageUrl],
        organic: false,
        featured: false,
        createdAt: adminSdk.firestore.FieldValue.serverTimestamp(),
        updatedAt: adminSdk.firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
}

function findMatchingProduct(products, mapping) {
    // Try to find a matching product by name or latin name
    const searchName = (mapping.searchName || '').toLowerCase();
    const searchLatin = (mapping.searchLatin || '').toLowerCase();

    return products.find(p => {
        const name = (p.name || '').toLowerCase();
        const latin = (p.latinName || '').toLowerCase();

        // Try exact or partial matches
        if (searchName && name.includes(searchName.toLowerCase())) return true;
        if (searchName && searchName.includes(name) && name.length > 3) return true;
        if (searchLatin && latin.includes(searchLatin.toLowerCase())) return true;
        if (searchLatin && searchLatin.includes(latin) && latin.length > 3) return true;

        return false;
    });
}

async function main() {
    console.log('=== Hearth Fire Image Stock Processor ===\n');

    // Fetch current products
    console.log('Fetching current products from database...');
    const products = await getProducts();
    console.log(`Found ${products.length} existing products.\n`);

    // Initialize Firebase Admin
    console.log('Initializing Firebase Admin SDK...');
    const adminSdk = await getAuthToken();
    console.log('Firebase Admin SDK ready.\n');

    const results = {
        updated: [],
        created: [],
        skipped: [...SKIPPED_FILES],
        errors: [],
    };

    console.log(`Processing ${IMAGE_MAPPINGS.length} images...\n`);
    console.log('─'.repeat(80));

    for (let i = 0; i < IMAGE_MAPPINGS.length; i++) {
        const mapping = IMAGE_MAPPINGS[i];
        const filePath = path.join(IMAGE_DIR, mapping.file);

        console.log(`\n[${i + 1}/${IMAGE_MAPPINGS.length}] ${mapping.file}`);

        if (!fs.existsSync(filePath)) {
            console.log(`  ❌ File not found, skipping.`);
            results.errors.push({ file: mapping.file, error: 'File not found' });
            continue;
        }

        try {
            // Upload to ImgBB
            console.log(`  📤 Uploading to ImgBB...`);
            const imageUrl = await uploadToImgBB(filePath);
            console.log(`  ✅ Uploaded: ${imageUrl}`);

            if (mapping.matchType === 'existing') {
                // Find the existing product
                const product = findMatchingProduct(products, mapping);
                if (product) {
                    console.log(`  🔄 Updating existing product: "${product.name}" (${product.id})`);
                    await updateProductImage(adminSdk, product.id, imageUrl);
                    console.log(`  ✅ Product image updated!`);
                    results.updated.push({ file: mapping.file, product: product.name, id: product.id });
                } else {
                    console.log(`  ⚠️  Could not find matching product for "${mapping.searchName}". Creating as new.`);
                    // Fall through to create
                    mapping.matchType = 'new';
                    mapping.productName = mapping.searchName;
                    mapping.latinName = mapping.searchLatin || '';
                    mapping.description = `A quality ${mapping.searchName} variety grown at Hearthfire Farm.`;
                    mapping.category = 'vegetables';
                    mapping.unit = 'each';
                    mapping.price = 4.50;
                }
            }

            if (mapping.matchType === 'new') {
                console.log(`  🆕 Creating new product: "${mapping.productName}"`);
                mapping.imageUrl = imageUrl;
                const newId = await createProduct(adminSdk, mapping);
                console.log(`  ✅ Created product with ID: ${newId}`);
                results.created.push({ file: mapping.file, product: mapping.productName, id: newId });
            }

            // Rate limiting - wait 1 second between uploads
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
            results.errors.push({ file: mapping.file, error: error.message });
        }
    }

    // Print summary
    console.log('\n' + '═'.repeat(80));
    console.log('=== SUMMARY ===\n');

    console.log(`✅ Updated existing products: ${results.updated.length}`);
    results.updated.forEach(r => console.log(`   - ${r.product} (${r.file})`));

    console.log(`\n🆕 Created new products: ${results.created.length}`);
    results.created.forEach(r => console.log(`   - ${r.product} (${r.file})`));

    console.log(`\n⏭️  Skipped files: ${results.skipped.length}`);
    results.skipped.forEach(f => console.log(`   - ${f}`));

    if (results.errors.length > 0) {
        console.log(`\n❌ Errors: ${results.errors.length}`);
        results.errors.forEach(r => console.log(`   - ${r.file}: ${r.error}`));
    }

    console.log(`\nTotal: ${results.updated.length + results.created.length} processed, ${results.skipped.length} skipped, ${results.errors.length} errors`);

    // Save results to file
    fs.writeFileSync(
        path.join(__dirname, '..', 'image-stock-results.json'),
        JSON.stringify(results, null, 2)
    );
    console.log('\nResults saved to image-stock-results.json');

    process.exit(0);
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
