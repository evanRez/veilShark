const puppeteer = require("puppeteer");
var cron = require("node-cron");
const { password } = require("./password");

/*-------------------------------------------------------------
    If makesPurchase is set to true it MAY actually checkout
  --------------------------------------------------------------*/
// const makesPurchase = false;

// let cronString = '0/1 10 16 4 Fri'; //April 16 every minute
let cronString = "* * * * *";

/*-------------------------------------------------------------
    Log in Details
  --------------------------------------------------------------*/
const email = "ereznice@gmail.com";
const pass = password;

/*-------------------------------------------------------------
    ProductKey checks for 'Anniversary' category
  --------------------------------------------------------------*/
const productPageKey = "Anniversary";

/*-------------------------------------------------------------
    Set Pick up Date & Time (time is increments of 15min from opening)
  --------------------------------------------------------------*/
let pickUpDate = "7";
let pickUpTime = "0/5|0.00";
let tipAmount = "5";

/*-------------------------------------------------------------
    The wishList must be in this format and the names must be spelled EXACTLY right for these to work 
  --------------------------------------------------------------*/

let wishList = [
  { name: "Cherry Limeade Fizzee 4-Pack 16oz cans", qty: 1, href: "" },
];

/*BEGIN LAUNCH OF CRAWLER */

const veilCrawler = async () => {
  const browser = await puppeteer.launch(
    {
      headless: false,
    },
    { executablePath: "/Applications/Google Chrome.app" }
  );

  /*-------------------------------------------------------------
    Go to Veil Brewing Shop
  --------------------------------------------------------------*/

  const page = await browser.newPage();
  try {
    await page.goto("https://shop.theveilbrewing.com/shop/", {
      waitUntil: "networkidle0",
    });
  } catch (err) {
    console.log("Couldnt get to shop page from launch");
    await page.goto("https://www.theveilbrewing.com/home");
  }

  /*-------------------------------------------------------------
    Pass Age Gate to enter site
  --------------------------------------------------------------*/

  try {
    await page.waitForSelector(".age-gate-submit-yes");
    await page.click(".age-gate-submit-yes");
  } catch (err) {
    console.log("couldn't get past age-gate");
  }

  /*-------------------------------------------------------------
    Check for / Navigate to the anniverary beer page 
  --------------------------------------------------------------*/

  try {
    const beersPage = await page.evaluate((productPageKey) => {
      let h2el = document.querySelectorAll(".woocommerce-loop-category__title");
      let annyPage;
      h2el.forEach((cat) => {
        if (cat.innerText.includes(productPageKey)) {
          annyPage = cat.parentNode.href;
        } else
          annyPage = "https://shop.theveilbrewing.com/product-category/beers/";
      });
      return annyPage;
    }, productPageKey);

    await page.goto(beersPage, {
      waitUntil: "networkidle0",
    });
  } catch (err) {
    console.log("something happened going to beer page");
    console.log(err);
  }

  /*-------------------------------------------------------------
    Add wishlist products to the cart
  --------------------------------------------------------------*/

  try {
    wishList = await page.evaluate((wishList) => {
      let beerList = document.querySelectorAll(".product");

      let nameList = [];
      beerList.forEach((beer) => {
        nameList.push({
          name: beer.children[0].children[1].innerText,
          href: beer.lastChild.href,
        });
      });

      let filteredList = [];
      for (let i of wishList) {
        filteredList.push(nameList.filter((beer) => beer.name === i.name));
      }

      let midArr = filteredList.flat();

      wishList.forEach((beer, index) => {
        idx2 = midArr[index];
        beer.href = idx2.href;
      });
      return wishList;
    }, wishList);

    // console.log(wishList);
    for (let beer of wishList) {
      await page.goto(beer.href, {
        waitUntil: "networkidle0",
      });
    }
  } catch (err) {
    console.log("something went wrong adding beers to the cart");
    console.log(err);
  }

  /*-------------------------------------------------------------
    Navigate to Cart
  --------------------------------------------------------------*/

  try {
    await page.waitForSelector(".button.wc-forward");
    await page.goto("https://shop.theveilbrewing.com/cart/", {
      waitUntil: "networkidle0",
    });
  } catch (err) {
    console.log(err);
    console.log("err waiting for cart/ clicking on cart button");
  }

  /*-------------------------------------------------------------
    Update qty in cart to match wishList
  --------------------------------------------------------------*/

  try {
    await page.evaluate((wishList) => {
      let cartItems = document.querySelectorAll(
        ".woocommerce-cart-form__cart-item.cart_item"
      );

      cartItems.forEach((item, index) => {
        idx2 = wishList[index];
        if (item.querySelector(".product-name").innerText == idx2.name) {
          item.querySelector('[title="Qty"]').value = idx2.qty;
        }
      });

      let cartUpdateBtn = document.querySelector('[name="update_cart"]');
      cartUpdateBtn.removeAttribute("disabled");

      return cartItems, cartUpdateBtn;
    }, wishList);

    await page.click('[name="update_cart"]');
  } catch (err) {
    console.log("something went wrong adjusting qty");
  }

  /*-------------------------------------------------------------
    Proceed to check out page
  --------------------------------------------------------------*/

  try {
    await page.waitForTimeout(2000);
    await page.click(".checkout-button");
  } catch (err) {
    console.log("error on checkout button click");
  }

  /*-------------------------------------------------------------
    Log in to automate info, preferred payment
  --------------------------------------------------------------*/

  await page.waitForSelector("#billing_first_name_field");

  try {
    await page.click(".showlogin");
    await page.type("#username", email);
    await page.type("#password", pass);
    await page.click(".woocommerce-form-login__submit");
    await page.waitForNavigation({ waitUntil: "networkidle0" });
  } catch (err) {
    console.log("error trying to log-in");
  }

  /*-------------------------------------------------------------
    Click Local Pickup
  --------------------------------------------------------------*/

  try {
    await page.evaluate(() => {
      let localPickUp = document.querySelector(
        "#shipping_method_0_local_pickup2"
      );
      localPickUp.click();
    });
    await page.waitForTimeout(2000);
  } catch (err) {
    console.log("error selecting local pick up radio button");
  }

  try {
    await page.select("#f040eb4", tipAmount);
    await page.waitForTimeout(1000);
  } catch (err) {
    console.log("couldn't select tip amount");
  }

  /*-------------------------------------------------------------
    Choose Pick up Day & Time
  --------------------------------------------------------------*/

  try {
    await page.evaluate((pickUpDate) => {
      let pickUpDays = document.querySelectorAll(
        ".iconic-wds-date.iconic-wds-date--fee"
      );

      pickUpDays.forEach((availDay) => {
        if (availDay.innerText == pickUpDate) {
          availDay.click();
          availDay.firstChild.click();
        }
      });
    }, pickUpDate);
    terminateProcess = true;
    await page.waitForTimeout(1000);

    await page.select("#jckwds-delivery-time", pickUpTime);
  } catch (err) {
    console.log("Error handing date or time selection");
  }

  /*-------------------------------------------------------------
    Terms and conditions
  --------------------------------------------------------------*/

  try {
    await page.evaluate(() => {
      document.querySelector("#terms").click();
    });
  } catch (err) {
    console.log("clicking terms and conditions");
  }

  /*-------------------------------------------------------------
    Make purchase
  --------------------------------------------------------------*/
  try {
    await page.evaluate(() => {
      document.querySelector("#place_order").click();
    });
    await page.waitForNavigation();
    process.exit();
  } catch (err) {
    console.log("Could not submit the form for some reason");
    console.log(err);
  }
};

cron.schedule(cronString, veilCrawler);

// let wishList = [
//   { name: "Melancholia & Apathy 750ml Bottle", qty: 1, href: "" },
//   { name: "Premium Sauce 4-Pack 16oz cans", qty: 1, href: "" },
// ];
