const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const { listingSchema } = require("../schema.js");
const ExpressError = require("../utils/ExpressError.js");
const Listing = require("../models/listing.js");
const wrapAsync = require("../utils/WrapAsync.js");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");
const listingController = require("../controllers/listings.js");
const multer = require("multer");
const { storage } = require("../Cloudconfig.js");
const upload = multer({ storage });
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


// INDEX + CREATE Routes

router
  .route("/") // INDEX route - list all listings
  .get(
    wrapAsync(async (req, res) => {
      const { category } = req.query;
      let allListings;

      if (category) {
        //  Ensure case-insensitive match
        allListings = await Listing.find({ category: category.toLowerCase() });
      } else {
        allListings = await Listing.find({});
      }

      res.render("listings/index", { allListings, category });
    })
  )
  .post(
    isLoggedIn,
    upload.single("listing[image]"),
    validateListing,
    wrapAsync(listingController.createListings)
  );


// NEW Listing Form

//router.get("/new", isLoggedIn, listingController.rendernewForm);
router.get("/new", isLoggedIn, listingController.renderNewForm);


// SHOW / EDIT / DELETE Routes

router
  .route("/:id")
  .get(wrapAsync(listingController.showListing)) // SHOW route
  .put(
    isLoggedIn,
    isOwner,
    upload.single("listing[image]"),
    validateListing,
    wrapAsync(listingController.upadateListing) // UPDATE route
  )
  .delete(isLoggedIn, isOwner, wrapAsync(listingController.destroyListing)); // DELETE route

// EDIT route - show form to edit a listing
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.renderEditForm));


// STRIPE PAYMENT Route

router.post(
  "/create-checkout-session/:id",
  isLoggedIn,
  wrapAsync(async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      throw new ExpressError("Listing not found", 404);
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: { name: listing.title },
            unit_amount: listing.price * 100,
          },
          quantity: 1,
        },
      ],
      success_url: `${req.protocol}://${req.get("host")}/success`,
      cancel_url: `${req.protocol}://${req.get("host")}/cancel`,
    });

    res.redirect(303, session.url);
  })
);

module.exports = router;
