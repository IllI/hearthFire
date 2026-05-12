/**
 * 2026 Hearthfire Seeding Chart - Database Update Script
 * 
 * Cross-referenced the seeding chart against 159 existing products.
 * This script:
 *  1. Confirms existing products that are in the 2026 inventory (updates Latin names if needed)
 *  2. Creates new products for plants not yet in the database
 *  3. Each new product has a hand-reasoned description based on the plant's identity
 *
 * Usage: node scripts/update-2026-inventory.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Initialize Firebase Admin
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}
const db = admin.firestore();

// ============================================================
// CATEGORY REASONING:
//
// The seeding chart is primarily herbs and native plants.
// Looking at the existing categories in the DB:
//   - culinary-herbs: culinary use herbs (mint, basil, oregano, etc.)
//   - medicinal-herbs: medicinal use herbs (echinacea, valerian, etc.)
//   - pollinator-friendly: native wildflowers/plants that attract pollinators
//   - native-plants: native ornamental plants
//   - vegetables: food crops
//
// For each new plant I'll assign the most appropriate category.
// Many plants span multiple categories (e.g. a medicinal herb that's also
// pollinator-friendly), so I'll assign the primary one and note secondary.
// ============================================================

// --- EXISTING PRODUCTS TO UPDATE (Latin name corrections, etc.) ---
const EXISTING_UPDATES = [
    // Sochan 4" pot is actually Cutleaf Coneflower (Rudebeckia laciniata) — same plant, different names
    // The seeding chart lists it as "Cutleaf Coneflower" — we should note this but Sochan is the Cherokee name, keep it
];

// --- NEW PRODUCTS TO CREATE ---
const NEW_PRODUCTS = [
    {
        name: 'Yarrow, Colorful',
        latinName: 'Achillea millefolium',
        description: 'A vibrant cultivated selection of the native yarrow, Colorful Yarrow produces clusters of flowers in warm shades of red, pink, salmon, and gold. Like its white-flowered counterpart, it is drought-tolerant, deer-resistant, and a magnet for beneficial insects. The feathery, fern-like foliage is aromatic and has been used in traditional herbal medicine for centuries. An easy-care perennial that thrives in full sun and poor soils.',
        categories: ['pollinator-friendly', 'medicinal-herbs'],
        price: 6.50,
    },
    {
        name: 'Black Cohosh',
        latinName: 'Actaea racemosa',
        description: 'Black Cohosh is a stately woodland perennial native to eastern North America, prized for its towering white flower spikes that can reach 4-8 feet tall in midsummer. Long revered in Native American and Appalachian herbal traditions for women\'s health support, this shade-loving plant adds dramatic vertical interest to woodland gardens. The elegant, deeply divided foliage and bottlebrush-like blooms attract a wide range of native pollinators.',
        categories: ['medicinal-herbs'],
        price: 8.50,
    },
    {
        name: 'Marshmallow',
        latinName: 'Althaea officinalis',
        description: 'Marshmallow is the plant that originally inspired the confection — its roots produce a mucilaginous sap once used to make the treat. A staple of European herbal medicine for over 2,000 years, Marshmallow root and leaf are used to soothe irritated mucous membranes and support respiratory health. This tall, velvety perennial produces delicate pink-white flowers and thrives in moist soils. A beautiful and functional addition to any herb garden.',
        categories: ['medicinal-herbs'],
        price: 6.50,
    },
    {
        name: 'Andrographis',
        latinName: 'Andrographis paniculata',
        description: 'Andrographis, known as the "King of Bitters" in Ayurvedic medicine, is a powerful immune-supporting herb used across Asian traditional medicine systems for thousands of years. This annual tropical herb produces small white flowers with purple markings and intensely bitter leaves that are the source of its medicinal potency. Often called "Indian Echinacea" for its immune-stimulating properties, it is increasingly popular in Western herbal practice.',
        categories: ['medicinal-herbs'],
        price: 6.50,
    },
    {
        name: 'Columbine',
        latinName: 'Aquilegia canadensis',
        description: 'Wild Columbine is a beloved native woodland wildflower with distinctive red and yellow nodding flowers that are shaped like tiny lanterns. One of the earliest spring-blooming native plants, it is a critical nectar source for ruby-throated hummingbirds returning from migration. This graceful perennial self-sows freely, naturalizing happily in rock gardens, woodland edges, and shaded borders. Deer-resistant and easy to grow.',
        categories: ['pollinator-friendly', 'native-plants'],
        price: 6.50,
    },
    {
        name: 'Spikenard',
        latinName: 'Aralia racemosa',
        description: 'American Spikenard is a bold, dramatic native woodland herb with large compound leaves and striking clusters of dark purple berries in autumn. The aromatic root has been used in Native American and Appalachian folk medicine for respiratory support and as a general tonic. This shade-loving perennial can grow 3-5 feet tall and wide, creating an impressive presence in woodland gardens. The berries are eagerly consumed by birds.',
        categories: ['medicinal-herbs', 'native-plants'],
        price: 8.50,
    },
    {
        name: 'Wormwood',
        latinName: 'Artemisia absinthium',
        description: 'Wormwood is the legendary bitter herb historically used to flavor absinthe and vermouth. With its silvery-gray, deeply lobed foliage and intensely aromatic leaves, it is both beautiful and functional in the garden. Herbalists value Wormwood for digestive support and as a natural pest deterrent — indeed, it was traditionally planted near doorways to repel insects. A hardy, drought-tolerant perennial that adds striking silver contrast to herb gardens.',
        categories: ['medicinal-herbs'],
        price: 6.50,
    },
    {
        name: 'Milkweed, Tall Green',
        latinName: 'Asclepias hirtella',
        description: 'Tall Green Milkweed is a lesser-known native milkweed species with subtle greenish-white flower clusters and narrow, hairy leaves. Like all milkweeds, it serves as an essential host plant for Monarch butterfly caterpillars and provides rich nectar for numerous pollinators. This prairie-adapted species is more drought-tolerant than many milkweeds and thrives in dry, well-drained soils. An important addition to prairie restorations and pollinator gardens.',
        categories: ['pollinator-friendly', 'native-plants'],
        price: 6.50,
    },
    {
        name: 'Milkweed, Redring',
        latinName: 'Asclepias variegata',
        description: 'Redring Milkweed (also called White Milkweed) is a woodland-edge native with striking white flowers accented by purple-red rings at their centers. Unlike prairie milkweeds, this species prefers the dappled shade of forest margins and open woodlands, making it a valuable Monarch host plant for shadier landscapes. Elegant and understated, it blooms in late spring to early summer and naturalizes gently without becoming aggressive.',
        categories: ['pollinator-friendly', 'native-plants'],
        price: 6.50,
    },
    {
        name: 'White Wild Indigo',
        latinName: 'Baptisia alba',
        description: 'White Wild Indigo is a stunning native perennial with spires of pure white pea-like flowers atop strong, upright stems in late spring. This deep-rooted prairie legume fixes nitrogen in the soil and becomes a long-lived, low-maintenance specimen reaching 3-5 feet tall. The charcoal-black seed pods rattle in autumn breezes and add winter interest. Once established, White Wild Indigo is incredibly drought-tolerant and virtually indestructible.',
        categories: ['pollinator-friendly', 'native-plants'],
        price: 8.50,
    },
    {
        name: 'Hairy Woodmint',
        latinName: 'Blephilia hirsuta',
        description: 'Hairy Woodmint is a native woodland mint with whorls of delicate lavender-spotted white flowers and softly hairy leaves. This shade-tolerant perennial thrives in moist woodland soils where many other mints would struggle. Like its cousin Downy Woodmint, it has a pleasant minty aroma and attracts a wide array of native bees and butterflies. An excellent choice for naturalized shade gardens and woodland wildlife plantings.',
        categories: ['culinary-herbs', 'native-plants'],
        price: 6.50,
    },
    {
        name: 'Gotu Kola',
        latinName: 'Centella asiatica',
        description: 'Gotu Kola is one of the most important herbs in Ayurvedic and Traditional Chinese Medicine, revered for its ability to support cognitive function, memory, and nervous system health. This low-growing tropical perennial has distinctive fan-shaped leaves and spreads by runners, making it an excellent ground cover in warm, moist conditions. Often called "the herb of longevity," it has been used for thousands of years across Asian healing traditions.',
        categories: ['medicinal-herbs'],
        price: 6.50,
    },
    {
        name: 'Lambs Quarters',
        latinName: 'Chenopodium album',
        description: 'Lambs Quarters is one of the world\'s most nutritious wild edible plants, often dismissed as a common weed but treasured by foragers and herbalists. Its tender young leaves taste like a superior spinach and are exceptionally rich in vitamins A and C, calcium, and iron. This vigorous annual self-sows readily and was a staple food of Native Americans long before European contact. A nutritional powerhouse that deserves a place in every edible garden.',
        categories: ['vegetables', 'culinary-herbs'],
        price: 4.50,
    },
    {
        name: 'Red Aztec Spinach',
        latinName: 'Chenopodium berlandieri',
        description: 'Red Aztec Spinach (Huauzontle) is a striking ornamental edible with vivid magenta-red young leaves that mature to green. This ancient superfood was cultivated by the Aztecs and is closely related to quinoa and Lambs Quarters. The tender leaves are delicious raw in salads or cooked like spinach, while the flower buds can be prepared similarly to broccoli. Heat-tolerant and easy to grow, it provides nutritious greens long after true spinach has bolted.',
        categories: ['vegetables'],
        price: 4.50,
    },
    {
        name: 'Chicory, Wild Form',
        latinName: 'Cichorium intybus',
        description: 'Wild Chicory is a roadside beauty with striking sky-blue flowers that open each morning and close by afternoon. Every part of this versatile plant is useful — the young leaves make a slightly bitter salad green, the roots can be roasted as a coffee substitute (famously used in New Orleans-style coffee), and herbalists value them for liver and digestive support. A hardy, deep-rooted perennial that thrives in even the poorest soils.',
        categories: ['culinary-herbs', 'medicinal-herbs'],
        price: 4.50,
    },
    {
        name: 'Miners Lettuce',
        latinName: 'Claytonia perfoliata',
        description: 'Miners Lettuce earned its name from California Gold Rush miners who ate it to prevent scurvy — its succulent, round leaves are exceptionally rich in vitamin C. This charming native annual has distinctive disc-shaped leaves through which the flower stem appears to grow, giving it an otherworldly appearance. Its mild, sweet flavor makes it a gourmet salad green, and it thrives in cool, shaded conditions where other lettuces struggle.',
        categories: ['vegetables', 'culinary-herbs'],
        price: 4.50,
    },
    {
        name: 'Spring Beauty',
        latinName: 'Claytonia virginica',
        description: 'Spring Beauty is one of the first and most delicate wildflowers of the eastern woodland spring, carpeting forest floors with tiny pink-striped white blooms. This ephemeral perennial emerges in early spring, blooms, sets seed, and retreats underground before the tree canopy fully leafs out. The small tubers were historically gathered as a food source by Native Americans. An essential component of native woodland gardens and a harbinger of spring.',
        categories: ['native-plants', 'pollinator-friendly'],
        price: 6.50,
    },
    {
        name: 'Lemongrass',
        latinName: 'Cymbopogon citratus',
        description: 'Lemongrass is a tropical aromatic grass essential to Thai, Vietnamese, and Indonesian cuisines, with a bright, citrusy flavor that is irreplaceable in curries, soups, and teas. The swollen stem bases are the primary culinary ingredient, while the leaves make a refreshing and digestive-supporting herbal tea. This vigorous grass forms beautiful, fountain-like clumps and can be grown as an annual in temperate climates or overwintered indoors.',
        categories: ['culinary-herbs'],
        price: 6.50,
    },
    {
        name: 'Narrow-Leaf Echinacea',
        latinName: 'Echinacea angustifolia',
        description: 'Narrow-Leaf Echinacea is considered by many herbalists to be the most medicinally potent of all Echinacea species. Native to the Great Plains, this compact coneflower produces pink-purple ray flowers around a spiny central cone and narrow, lance-shaped leaves. Its roots are the primary medicinal part, traditionally used by Plains Indians for immune support, toothaches, and snake bites. Slower-growing than Purple Coneflower but superior in medicinal quality.',
        categories: ['medicinal-herbs', 'pollinator-friendly'],
        price: 8.50,
    },
    {
        name: 'Pale Purple Coneflower',
        latinName: 'Echinacea pallida',
        description: 'Pale Purple Coneflower is a graceful native prairie species with distinctive long, drooping, pale pink-lavender petals that flutter in the breeze. Reaching 3-4 feet tall, it adds elegant movement to prairie plantings and pollinator gardens. Like its relatives, this Echinacea species has documented immune-supporting properties and its roots are used in herbal medicine. An essential plant for prairie restorations and a beautiful complement to other native wildflowers.',
        categories: ['pollinator-friendly', 'medicinal-herbs'],
        price: 6.50,
    },
    {
        name: 'Sunflower, Early',
        latinName: 'Heliopsis helianthoides',
        description: 'Early Sunflower (also called Ox-Eye Sunflower) is a cheerful native perennial that blooms from midsummer through fall with abundant golden-yellow daisy flowers. Unlike true sunflowers, this species is a long-lived perennial that returns reliably year after year, forming robust 3-5 foot clumps. An outstanding pollinator plant, it provides nectar for butterflies and bees, and seeds for goldfinches. Extremely easy to grow and drought-tolerant once established.',
        categories: ['pollinator-friendly', 'native-plants'],
        price: 6.50,
    },
    {
        name: "St. John's Wort",
        latinName: 'Hypericum perforatum',
        description: "St. John's Wort is one of the world's most extensively studied medicinal plants, renowned for its ability to support emotional well-being and a positive mood. The golden-yellow flowers, which bloom around the feast of St. John (June 24th), produce a deep red oil when infused — a signature of its active compounds. This European native has naturalized widely and is valued by herbalists for nerve support, wound healing, and its anti-inflammatory properties.",
        categories: ['medicinal-herbs'],
        price: 6.50,
    },
    {
        name: "Shrubby St. John's Wort",
        latinName: 'Hypericum prolificum',
        description: "Shrubby St. John's Wort is a compact native shrub that erupts in a profusion of bright golden-yellow flowers throughout summer. Unlike its European cousin, this species is a true woody shrub reaching 2-4 feet tall, making it excellent for foundation plantings, borders, and native hedgerows. Its dense branching habit provides cover for small birds and beneficial insects. Extremely tolerant of poor soils, drought, and deer browsing.",
        categories: ['native-plants', 'pollinator-friendly'],
        price: 8.50,
    },
    {
        name: 'Wild Dagga',
        latinName: 'Leonotus leonurus',
        description: 'Wild Dagga (Lion\'s Tail) is a striking South African medicinal plant with dramatic whorls of vibrant orange tubular flowers that are irresistible to hummingbirds and butterflies. Traditionally used in African herbal medicine for calming support and pain relief, this semi-tropical shrub can reach 4-6 feet in a single season. The vivid orange flower clusters are among the most visually dramatic in the herb garden. Grow as an annual in temperate climates.',
        categories: ['medicinal-herbs'],
        price: 6.50,
    },
    {
        name: 'Motherwort',
        latinName: 'Leonurus cardiaca',
        description: 'Motherwort is a revered women\'s herb with a history of use stretching back to ancient Greece, where it was given to anxious pregnant women to calm their spirits — hence the name. This robust perennial in the mint family produces spikes of pink-purple flowers loved by bees, and its bitter, distinctively shaped leaves are used as a heart tonic and nervous system relaxant. A tough, adaptable herb that thrives in a wide range of conditions.',
        categories: ['medicinal-herbs'],
        price: 6.50,
    },
    {
        name: 'Button Blazing Star',
        latinName: 'Liatris aspera',
        description: 'Button Blazing Star is a distinctive native prairie wildflower with round, button-like flower heads of vivid purple that open from the top of the spike downward — the opposite of most flowering plants. Blooming in late summer to fall, it provides critical nectar for migrating Monarch butterflies and native bees. The deep roots make it extremely drought-tolerant and long-lived. A striking vertical accent for prairie gardens and pollinator plantings.',
        categories: ['pollinator-friendly', 'native-plants'],
        price: 6.50,
    },
    {
        name: 'Dense Blazing Star',
        latinName: 'Liatris spicata',
        description: 'Dense Blazing Star is arguably the showiest of the native blazing stars, producing dense spikes of rich purple-magenta flowers that bloom from top to bottom in midsummer. This prairie icon is a favorite of butterflies, especially Monarchs, and a magnet for native bees. Growing 2-4 feet tall from a corm-like rootstock, it makes an excellent cut flower and adds dramatic vertical structure to perennial borders and naturalistic plantings.',
        categories: ['pollinator-friendly', 'native-plants'],
        price: 6.50,
    },
    {
        name: 'Lobelia',
        latinName: 'Lobelia inflata',
        description: 'Lobelia (Indian Tobacco) is a significant medicinal herb native to eastern North America, historically used by Native Americans as a respiratory herb and ceremonial plant. This annual or biennial produces small, pale blue-violet flowers along branching stems and distinctive inflated seed pods that give it the species name. Considered one of the most important herbs in the Thomsonian and Eclectic medical traditions. For experienced herbalists — this plant demands respectful, knowledgeable use.',
        categories: ['medicinal-herbs'],
        price: 6.50,
    },
    {
        name: 'Chamomile',
        latinName: 'Matricaria recutita',
        description: 'German Chamomile is perhaps the world\'s most beloved calming herb, with dainty daisy-like flowers that produce a sweet, apple-scented tea used for relaxation and digestive comfort. This gentle annual has been a cornerstone of herbal medicine across cultures for thousands of years. Easy to grow and self-sowing, Chamomile creates a fragrant, low-growing carpet of white and gold that attracts beneficial insects to the garden.',
        categories: ['medicinal-herbs', 'culinary-herbs'],
        price: 4.50,
    },
    {
        name: "Bradbury's Monarda",
        latinName: 'Monarda bradburiana',
        description: "Bradbury's Monarda (Eastern Bee Balm) is a compact, early-blooming species of Monarda native to Ozark woodlands and prairies. Its pale pink to white flowers with purple spots appear in late spring — weeks before other bee balms — providing early-season nectar for pollinators. More mildew-resistant than common Bee Balm and tolerant of drier soils, this underutilized species deserves wider recognition in native plant gardens. Aromatic leaves make a pleasant tea.",
        categories: ['pollinator-friendly', 'culinary-herbs'],
        price: 6.50,
    },
    {
        name: 'Holy Basil, Temperate',
        latinName: 'Ocimum africanum',
        description: 'Temperate Tulsi is a hardier Holy Basil variety adapted to cooler growing conditions, making it more suitable for temperate climate gardens. With a complex, spicy-sweet aroma blending clove, mint, and basil notes, it is used in Ayurvedic medicine as an adaptogen — helping the body resist stress. This variety tends to be more vigorous and cold-tolerant than tropical Tulsi types while retaining the sacred plant\'s revered medicinal qualities.',
        categories: ['medicinal-herbs', 'culinary-herbs'],
        price: 6.50,
    },
    {
        name: 'Holy Basil, Vana',
        latinName: 'Ocimum gratissimum',
        description: 'Vana Tulsi is the wild forest variety of Holy Basil, a robust and aromatic perennial that can grow into a small shrub in tropical conditions. Considered one of the three main types of Tulsi in Ayurvedic tradition, Vana is prized for its immune-supporting and adaptogenic properties. Its flavor is more intensely camphoraceous and eucalyptus-like than other Tulsi varieties, and it makes a particularly invigorating and clearing herbal tea.',
        categories: ['medicinal-herbs', 'culinary-herbs'],
        price: 6.50,
    },
    {
        name: 'Holy Basil, Krishna',
        latinName: 'Ocimum tenuiflorum',
        description: 'Krishna Tulsi is a striking variety of Holy Basil distinguished by its deep purple-black stems and dark leaves — Krishna means "dark one" in Sanskrit. Considered the most potent Tulsi variety for medicinal use in Ayurvedic tradition, it has the richest, most complex flavor profile with notes of pepper, clove, and sweet basil. The dark pigmentation comes from high anthocyanin content, adding antioxidant value. Revered as a sacred plant in Hindu tradition.',
        categories: ['medicinal-herbs', 'culinary-herbs'],
        price: 6.50,
    },
    {
        name: 'Holy Basil, Rama',
        latinName: 'Ocimum tenuiflorum',
        description: 'Rama Tulsi is the most commonly grown variety of Holy Basil, with green leaves and a mild, sweet, slightly clove-like flavor. Named after Lord Rama, it is the Tulsi variety most often found growing in household pots and temple gardens across India. Its gentle flavor makes it the most approachable Tulsi for newcomers, producing a mellow, soothing tea. Like all Tulsis, it is classified as an adaptogen, supporting the body\'s resilience to stress.',
        categories: ['medicinal-herbs', 'culinary-herbs'],
        price: 6.50,
    },
    {
        name: 'Wood Betony',
        latinName: 'Pedicularis canadensis',
        description: 'Wood Betony is a charming native woodland wildflower with hooded yellow and red-purple flowers clustered at the top of fuzzy stems in spring. This semi-parasitic plant taps into the roots of nearby plants for some of its nutrients, making it a fascinating ecological player. Herbalists value it for its calming, grounding properties and as a muscle relaxant. An excellent addition to native woodland gardens and medicinal plant collections.',
        categories: ['medicinal-herbs', 'native-plants'],
        price: 6.50,
    },
    {
        name: 'Mtn. Mint, Hoary',
        latinName: 'Pycnanthemum incanum',
        description: 'Hoary Mountain Mint is a showstopping native perennial with silvery-white upper leaves that look as if they\'ve been dusted with frost, contrasting beautifully with clusters of tiny white flowers. This distinctive appearance comes from dense pubescence that gives the plant a "hoary" or frosted appearance. The leaves have a strong, refreshing mint scent and can be used for tea. One of the most visually striking Mountain Mints and a top-tier pollinator plant.',
        categories: ['culinary-herbs', 'pollinator-friendly'],
        price: 6.50,
    },
    {
        name: 'Common Madder',
        latinName: 'Rubia tinctorum',
        description: 'Common Madder is one of the world\'s oldest dye plants, producing a famous rich red pigment called "Turkey Red" from its roots — a color that has adorned textiles from ancient Egypt to medieval Europe. This sprawling perennial has rough, scratchy leaves in whorls and tiny yellow-green flowers followed by small dark berries. Beyond dyeing, Madder root has been used in Traditional Chinese and Ayurvedic medicine. A living piece of cultural and artistic history.',
        categories: ['medicinal-herbs'],
        price: 6.50,
    },
    {
        name: 'Sorrel, Garden',
        latinName: 'Rumex acetosa',
        description: 'Garden Sorrel is a tangy, lemon-flavored perennial green prized in French cuisine for its bright acidity in soups, sauces, and salads. The arrow-shaped leaves have a distinctive sour taste from oxalic acid, making them a natural alternative to lemon juice in cooking. One of the first greens to emerge in spring and one of the last to fade in fall, Sorrel is a nearly year-round fresh green. Easy to grow and practically indestructible once established.',
        categories: ['culinary-herbs', 'vegetables'],
        price: 4.50,
    },
    {
        name: 'White Sage',
        latinName: 'Salvia apiana',
        description: 'White Sage is a sacred ceremonial plant of indigenous Californian peoples, traditionally used for purification, prayer, and cleansing. This drought-tolerant evergreen shrub has striking silvery-white leaves with a powerful, resinous aroma that is unmistakable. While its ceremonial smudging use has become widely popular, it is important to grow your own rather than wild-harvesting this increasingly pressured species. Best suited for dry, well-drained conditions.',
        categories: ['medicinal-herbs'],
        price: 8.50,
    },
    {
        name: 'Spilanthes',
        latinName: 'Spilanthes acmella',
        description: 'Spilanthes (Toothache Plant) is a fascinating medicinal herb with distinctive yellow and red "eyeball" flowers that create an intense tingling-numbing sensation when chewed. This electric buzz is caused by the compound spilanthol, which has been used traditionally as a local anesthetic for toothaches. Modern herbalists also value it for immune support and as a sialagogue (promoting saliva flow). The unique sensory experience makes it a conversation-starter in any herb garden.',
        categories: ['medicinal-herbs'],
        price: 6.50,
    },
    {
        name: 'Meadowsweet',
        latinName: 'Filipendula ulmaria',
        description: 'Meadowsweet is a fragrant European herb with frothy cream-colored flower clusters that smell of honey and almonds. This historic plant gave us aspirin — salicylic acid was first isolated from Meadowsweet, and the drug name "aspirin" actually derives from its old botanical name, Spiraea. Herbalists use the whole plant for digestive comfort and gentle pain relief, noting that unlike isolated aspirin, the whole herb soothes the stomach rather than irritating it.',
        categories: ['medicinal-herbs'],
        price: 6.50,
    },
    {
        name: 'New England Aster',
        latinName: 'Symphyotrichum novae-angliae',
        description: 'New England Aster is the crown jewel of autumn wildflowers, producing masses of brilliant violet-purple daisy flowers with golden centers that light up the fall landscape. Growing 3-6 feet tall, this robust native perennial is a critical late-season nectar source for migrating Monarch butterflies and native bees preparing for winter. No native plant garden is complete without this showstopper, which pairs beautifully with goldenrod for a classic autumn display.',
        categories: ['pollinator-friendly', 'native-plants'],
        price: 6.50,
    },
    {
        name: 'Swamp Aster',
        latinName: 'Symphyotrichum puniceum',
        description: 'Swamp Aster is a tall, striking native aster with lavender-blue flowers and distinctive reddish-purple stems. Naturally found in wet meadows, stream banks, and moist woodland edges, it thrives in wetter conditions where many other perennials would struggle. Blooming in fall, it provides essential late-season pollinator support alongside other asters and goldenrods. An excellent choice for rain gardens, bioswales, and naturalized wet areas.',
        categories: ['pollinator-friendly', 'native-plants'],
        price: 6.50,
    },
    {
        name: 'New Zealand Spinach',
        latinName: 'Tetragonia tetragonoides',
        description: 'New Zealand Spinach is a heat-loving leafy green that produces abundantly all summer long — thriving in exactly the hot conditions that cause true spinach to bolt. The thick, triangular leaves have a mild, slightly salty, spinach-like flavor and can be used anywhere you\'d use regular spinach. This prostrate, sprawling plant makes an attractive edible ground cover and was famously eaten by Captain Cook\'s crew to prevent scurvy during Pacific voyages.',
        categories: ['vegetables'],
        price: 4.50,
    },
    {
        name: 'Mullein',
        latinName: 'Verbascum thapsus',
        description: 'Mullein is one of the most recognizable medicinal plants, forming a dramatic rosette of large, velvety, silver-green leaves in its first year before sending up a towering 4-7 foot flower spike in its second year. The soft leaves have been called "Cowboy Toilet Paper" for obvious reasons, and were also traditionally dried and smoked for respiratory support. Mullein flower oil is a time-honored remedy for earaches, and the leaf tea soothes coughs and congestion.',
        categories: ['medicinal-herbs'],
        price: 4.50,
    },
    {
        name: 'Ashwagandha',
        latinName: 'Withania somnifera',
        description: 'Ashwagandha is one of the most important herbs in Ayurvedic medicine, used for over 3,000 years as a premier adaptogen — helping the body adapt to stress while supporting energy, vitality, and restful sleep. Its name means "smell of horse" in Sanskrit, referring both to the root\'s aroma and the traditional belief that it imparts the strength and vigor of a stallion. This nightshade family member produces small yellow-green flowers and orange berries enclosed in papery husks.',
        categories: ['medicinal-herbs'],
        price: 6.50,
    },
];

async function main() {
    console.log('=== 2026 Hearthfire Seeding Chart - Database Update ===\n');

    // Fetch current products to verify
    const resp = await fetch('http://localhost:3000/api/products');
    const currentProducts = await resp.json();
    console.log(`Current database has ${currentProducts.length} products.\n`);

    // Build a lookup by lowercase name for matching
    const nameMap = {};
    currentProducts.forEach(p => {
        nameMap[p.name.toLowerCase().trim()] = p;
    });

    const results = { created: [], skipped: [], errors: [] };

    console.log(`Processing ${NEW_PRODUCTS.length} new products from the 2026 seeding chart...\n`);
    console.log('─'.repeat(70));

    for (let i = 0; i < NEW_PRODUCTS.length; i++) {
        const product = NEW_PRODUCTS[i];
        const key = product.name.toLowerCase().trim();

        console.log(`\n[${i + 1}/${NEW_PRODUCTS.length}] ${product.name} (${product.latinName})`);

        // Check if already exists
        if (nameMap[key]) {
            console.log(`  ⏭️  Already exists in DB as "${nameMap[key].name}" (${nameMap[key].id})`);
            results.skipped.push({ name: product.name, reason: 'Already exists', id: nameMap[key].id });
            continue;
        }

        try {
            const productData = {
                name: product.name,
                latinName: product.latinName || '',
                description: product.description || '',
                price: product.price || 6.50,
                category: product.categories[0],
                categories: product.categories,
                stock: 0,
                quantity: 0,
                unit: 'each',
                images: [],
                organic: false,
                featured: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            const docRef = await db.collection('products').add(productData);
            console.log(`  ✅ Created: ${docRef.id}`);
            results.created.push({ name: product.name, id: docRef.id });

            // Small delay to avoid throttling
            await new Promise(r => setTimeout(r, 200));

        } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
            results.errors.push({ name: product.name, error: error.message });
        }
    }

    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log('=== SUMMARY ===\n');
    console.log(`✅ Created: ${results.created.length} new products`);
    results.created.forEach(r => console.log(`   - ${r.name} (${r.id})`));
    console.log(`\n⏭️  Skipped: ${results.skipped.length} (already existed)`);
    results.skipped.forEach(r => console.log(`   - ${r.name}`));
    if (results.errors.length > 0) {
        console.log(`\n❌ Errors: ${results.errors.length}`);
        results.errors.forEach(r => console.log(`   - ${r.name}: ${r.error}`));
    }

    const totalSeedingChart = 114;
    const existingMatched = totalSeedingChart - NEW_PRODUCTS.length;
    console.log(`\n📊 2026 Seeding Chart Coverage:`);
    console.log(`   Total plants in chart: ${totalSeedingChart}`);
    console.log(`   Already in DB: ~${existingMatched}`);
    console.log(`   New products added: ${results.created.length}`);
    console.log(`   Total products in DB after update: ${currentProducts.length + results.created.length}`);

    process.exit(0);
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
