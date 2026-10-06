/**
 * Quick Checkout — a shop's link-in-bio page. See docs/QUICK-CHECKOUT.md.
 *
 * `./model` is pure (the admin server and the AI pipeline import it);
 * `./render` is the React page both apps draw.
 */

export * from './model'
export {
  QuickCheckoutPage,
  type QcLinkKind,
  type QcProductView,
  type QuickCheckoutPageProps,
} from './render'
