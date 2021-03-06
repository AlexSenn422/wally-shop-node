const ObjectId = require('mongoose').Types.ObjectId;
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const router = require('express').Router();

const accessOptions = require('../../../enums/access-options');
const errors = require('../../../errors');
const authenticate = require('../../../middleware/authenticate');
const arrangeInput = require('../../../middleware/arrange-inputs');


/**
 *  @swagger
 *  /api/user/payment:
 *    post:
 *      tags:
 *        - user/payment
 *      description: Creates payment method for a customer
 *      parameters:
 *        - name: stripeToken
 *          description: Stripe Card Token generated by stripe.js
 *          in: formData
 *          type: string
 *        - name: addressCity
 *          description: Billing address city
 *          default: New York
 *          in: formData
 *          type: string
 *        - name: addressCountry
 *          description: Billing address country
 *          default: US
 *          in: formData
 *          type: string
 *        - name: addressLine1
 *          description: Billing address line 1
 *          default: 12 Flowers str.
 *          in: formData
 *          type: string
 *        - name: addressLine2
 *          description: Billing address line 2
 *          default: Apartments 20
 *          in: formData
 *          type: string
 *        - name: addressState
 *          description: Billing address state
 *          default: NY
 *          in: formData
 *          type: string
 *        - name: addressZip
 *          description: Billing address zip
 *          default: '123456'
 *          in: formData
 *          type: string
 *        - name: name
 *          in: formData
 *          type: string
 *          default: My payment method
 *          description: name of payment method
 *        - name: preferred_payment
 *          in: formData
 *          type: boolean
 *          default: false
 *          description: preferred_payment payment method
 *      responses:
 *        200:
 *          description: payment method plan created
 */
router.post('/api/user/payment',
    authenticate(null, [accessOptions.EMAIL_VALIDATED]),
    arrangeInput('body', {
        addressCity: {
            type: 'STRING',
        },
        addressCountry: {
            type: 'STRING',
        },
        addressLine1: {
            type: 'STRING',
        },
        addressLine2: {
            type: 'STRING'
        },
        addressState: {
            type: 'STRING',
        },
        addressZip: {
            type: 'STRING',
        },
        stripeToken: {
            type: 'STRING',
            required: true,
        },
        name: {
            type: 'STRING',
        },
        preferred_payment: {
            type: 'BOOLEAN',
        },

    }),
    errors.wrap(async (req, res) => {
        console.log(req.body);
        const user = res.locals.user;
        if (!user.stripe_customer_id || !user.stripe_customer_id === '') {
            try {
                const customer = await stripe.customers.create({
                    description: user.name,
                    metadata: {
                        'User Name': user.name,
                        'User Id': user._id.toString(),
                        'User Email': user.email,
                        'Phone': user.primary_telephone,
                    },
                });
                user.stripe_customer_id = customer.id;
            } catch (e) {
                console.error(e);
                throw errors.InternalServerError(e.message);
            }
        }

        // TODO ######################################
        // TODO generate stripe-token on front-end using stripe.js!
        // TODO remove this section after implement on the frontend
        // TODO ######################################
        // const fakeCardsList = require('../../../../test/mocks/stripe-cards');
        // const fakeCardNumber = fakeCardsList[Math.floor(Math.random() * fakeCardsList.length)];
        // const stripeToken = await stripe.tokens.create({
        //     card: {
        //         number: 378282246310005,
        //         exp_month: 12,
        //         exp_year: 2020,
        //         cvc: '123'
        //     }
        // });
        // const stripeToken = req.body.stripeToken;
        // const token = await stripe.tokens.retrieve(stripeToken.id);

        // TODO ######################################
        // TODO replace by given stripe-code
        // TODO ######################################
        // req.body.stripeToken = stripeToken.id;

        const card = await stripe.customers.createSource(user.stripe_customer_id, {source: req.body.stripeToken});
        if (user.payment.filter(method => method.fingerprint === card.fingerprint).length) {
            throw errors.InvalidInputError('Card already exists');
        }

        const paymentMethod = card;
        paymentMethod._id = ObjectId();
        paymentMethod.card_id = card.id;
        user.preferred_payment = req.body.preferred_payment
            ? paymentMethod._id
            : user.preferred_payment || paymentMethod._id;
        await user.payment.push(paymentMethod);
        await user.save();
        res.json(user);
    })
);

module.exports = router;
