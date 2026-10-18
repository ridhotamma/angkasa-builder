/**
 * The platform's default theme.
 *
 * A template shop whose own theme does not draw a page still renders through
 * the engine: this theme's template for that route stands in, with the same
 * drops and the same host slots the shop's theme would use. It is what makes
 * "the storefront renders everything through the engine" true — there is no
 * second render path to fall back to.
 *
 * It ships as source (compiled once per process by the host, see
 * `defaultTemplateTheme` in the storefront) rather than as a checked-in
 * generated module, so the templates are readable and a platform release can
 * improve them without a build step.
 *
 * Scoped under `.tpl-default`, and every route body wraps itself in that
 * class, so the default markup is styled wherever it is drawn — inside the
 * platform's own layout or inside a shop theme's.
 */

import type { ThemeFiles } from './theme'

const LAYOUT = `<div class="tpl-default">
  <header class="d-header">
    <a class="d-brand" href="{{ routes.home }}">
      {% if shop.logo_url %}<img src="{{ shop.logo_url }}" alt="" />{% endif %}
      <span>{{ shop.name }}</span>
    </a>
    <nav class="d-nav">
      <a href="{{ routes.products }}">Shop</a>
      {% for category in categories limit: 4 %}
        <a href="{{ category.url }}">{{ category.name }}</a>
      {% endfor %}
    </nav>
    <div class="d-actions">
      <a href="{{ routes.search }}">Search</a>
      {% slot 'cartTrigger' %}
    </div>
  </header>

  <main class="d-main">{{ content_for_layout }}</main>

  <footer class="d-footer">
    <p class="d-footer-name">{{ shop.name }}</p>
    <p class="d-footer-meta">
      {% if shop.address %}{{ shop.address }}{% elsif shop.email %}{{ shop.email }}{% endif %}
    </p>
  </footer>

  {% slot 'cartDrawer' %}
</div>
`

const HOME = `<div class="tpl-default">
  <section class="d-hero">
    <div>
      <h1>{{ shop.name }}</h1>
      <p>{{ shop.description | default: 'Everything we make, in one place.' }}</p>
      <a class="d-button" href="{{ routes.products }}">Shop all</a>
    </div>
    {% if shop.banner_url %}
      <img class="d-hero-image" src="{{ shop.banner_url }}" alt="{{ shop.name }}" />
    {% endif %}
  </section>

  <section class="d-band">
    <h2>New arrivals</h2>
    <div class="d-grid">
      {% for product in latest limit: 8 %}
        {% render 'product-card', product: product %}
      {% endfor %}
    </div>
  </section>

  {% for collection in collections limit: 2 %}
    <section class="d-band">
      <div class="d-band-head">
        <h2>{{ collection.name }}</h2>
        <a class="d-see-all" href="{{ collection.url }}">See all</a>
      </div>
      <div class="d-grid">
        {% for product in collection.products limit: 4 %}
          {% render 'product-card', product: product %}
        {% endfor %}
      </div>
    </section>
  {% endfor %}
</div>
`

const PRODUCT = `<div class="tpl-default">
  <article class="d-product">
    <div class="d-gallery">
      {% for image in product.images limit: 4 %}
        {% if image.url %}<img src="{{ image.url }}" alt="{{ product.title }}" />{% endif %}
      {% endfor %}
    </div>

    <div class="d-product-info">
      {% if product.category %}<p class="d-eyebrow">{{ product.category.name }}</p>{% endif %}
      <h1>{{ product.title }}</h1>

      {% if product.rating %}
        <p class="d-rating"><strong>{{ product.rating }}</strong> · {{ product.rating_count }} reviews</p>
      {% endif %}

      <p class="d-price">
        {{ product.price | money }}
        {% if product.on_sale %}<s>{{ product.compare_at_price | money }}</s>{% endif %}
      </p>

      {% if product.available != blank and product.available <= 0 %}
        <p class="d-sold-out">Sold out</p>
      {% endif %}

      <div class="d-slot">{% slot 'productPurchase' %}</div>

      {% if product.description %}<p class="d-description">{{ product.description }}</p>{% endif %}
    </div>
  </article>

  {% if product.related.size > 0 %}
    <section class="d-band">
      <h2>You may also like</h2>
      <div class="d-grid">
        {% for related in product.related limit: 4 %}
          {% render 'product-card', product: related %}
        {% endfor %}
      </div>
    </section>
  {% endif %}

  <section class="d-band">
    <h2>Reviews</h2>
    <div class="d-slot">{% slot 'productReviews' %}</div>
  </section>
</div>
`

const CATALOG = `<div class="tpl-default">
  <section class="d-listing-head">
    <h1>{{ listing.title }}</h1>
    {% if listing.description %}<p>{{ listing.description }}</p>{% endif %}
    {% if listing.categories.size > 0 %}
      <div class="d-chips">
        {% if listing.current == blank %}<a class="d-chip d-chip--active" href="{{ routes.products }}">All</a>{% else %}<a class="d-chip" href="{{ routes.products }}">All</a>{% endif %}
        {% for category in listing.categories limit: 12 %}
          <a class="d-chip" href="{{ category.url }}">{{ category.name }}</a>
        {% endfor %}
      </div>
    {% endif %}
  </section>

  <p class="d-count">{{ listing.total }} products</p>

  <div class="d-grid">
    {% for product in listing.products limit: 12 %}
      {% render 'product-card', product: product %}
    {% endfor %}
  </div>

  {% if listing.pages > 1 %}
    <nav class="d-pager">
      {% for pageNumber in (1..listing.pages) %}
        {% if pageNumber == listing.page %}
          <span class="d-pager-current">{{ pageNumber }}</span>
        {% else %}
          <a href="{{ pageNumber | page_url }}">{{ pageNumber }}</a>
        {% endif %}
      {% endfor %}
    </nav>
  {% endif %}
</div>
`

const SEARCH = `<div class="tpl-default">
  <section class="d-listing-head">
    <h1>{{ listing.title }}</h1>
    <form class="d-search" action="{{ routes.search }}" method="get" role="search">
      <input
        class="d-search-input"
        type="search"
        name="q"
        value="{{ search.query }}"
        placeholder="Search products…"
        aria-label="Search products"
      />
      <button class="d-button" type="submit">Search</button>
    </form>
  </section>

  <p class="d-count">{{ listing.total }} products</p>

  {% if listing.total > 0 %}
    <div class="d-grid">
      {% for product in listing.products limit: 12 %}
        {% render 'product-card', product: product %}
      {% endfor %}
    </div>
  {% else %}
    <p class="d-empty">Nothing matched. Try another word.</p>
  {% endif %}

  {% if listing.pages > 1 %}
    <nav class="d-pager">
      {% for pageNumber in (1..listing.pages) %}
        {% if pageNumber == listing.page %}
          <span class="d-pager-current">{{ pageNumber }}</span>
        {% else %}
          <a href="{{ pageNumber | page_url }}">{{ pageNumber }}</a>
        {% endif %}
      {% endfor %}
    </nav>
  {% endif %}
</div>
`

const PAGE = `<div class="tpl-default">
  <article class="d-article">
    <p class="d-eyebrow">{{ shop.name }}</p>
    <h1>{{ page.title }}</h1>
    <div class="d-article-body">{% slot 'pageBody' %}</div>
  </article>
</div>
`

const ARTICLE = `<div class="tpl-default">
  <article class="d-article">
    <p class="d-eyebrow">{{ article.blog.title }}</p>
    <h1>{{ article.title }}</h1>
    <p class="d-article-meta">
      {{ article.author_name | default: shop.name }} ·
      {{ article.published_at | date: '%d %B %Y' }} ·
      {{ article.reading_minutes }} min read
    </p>
    {% if article.cover_url %}
      <img class="d-article-cover" src="{{ article.cover_url }}" alt="" />
    {% endif %}
    <div class="d-article-body">{% slot 'articleBody' %}</div>
  </article>

  {% if article.related.size > 0 %}
    <section class="d-band">
      <h2>Read next</h2>
      <div class="d-grid d-grid--articles">
        {% for related in article.related limit: 3 %}
          <a class="d-card" href="{{ related.url }}">
            <span class="d-card-media">
              {% if related.cover_url %}<img src="{{ related.cover_url }}" alt="" loading="lazy" />{% endif %}
            </span>
            <span class="d-card-name">{{ related.title }}</span>
          </a>
        {% endfor %}
      </div>
    </section>
  {% endif %}
</div>
`

const BLOG = `<div class="tpl-default">
  <section class="d-listing-head">
    <h1>{{ blog.title }}</h1>
    {% if blog.description %}<p>{{ blog.description }}</p>{% endif %}
    {% if blog.tags.size > 0 %}
      <div class="d-chips">
        {% if blog.tag == blank %}<a class="d-chip d-chip--active" href="{{ blog.url }}">All</a>{% else %}<a class="d-chip" href="{{ blog.url }}">All</a>{% endif %}
        {% for tag in blog.tags limit: 12 %}
          {% if tag == blog.tag %}<a class="d-chip d-chip--active" href="{{ blog.url }}?tag={{ tag | url_encode }}">#{{ tag }}</a>{% else %}<a class="d-chip" href="{{ blog.url }}?tag={{ tag | url_encode }}">#{{ tag }}</a>{% endif %}
        {% endfor %}
      </div>
    {% endif %}
  </section>

  {% if articles.size > 0 %}
    <div class="d-grid d-grid--articles">
      {% for article in articles limit: 12 %}
        <a class="d-card" href="{{ article.url }}">
          <span class="d-card-media">
            {% if article.cover_url %}<img src="{{ article.cover_url }}" alt="" loading="lazy" />{% endif %}
          </span>
          <span class="d-card-name">{{ article.title }}</span>
          <span class="d-card-meta">{{ article.published_at | date: '%d %B %Y' }}</span>
        </a>
      {% endfor %}
    </div>
  {% else %}
    <p class="d-empty">No articles yet.</p>
  {% endif %}

  {% if blog.pages > 1 %}
    <nav class="d-pager">
      {% for pageNumber in (1..blog.pages) %}
        {% if pageNumber == blog.page %}
          <span class="d-pager-current">{{ pageNumber }}</span>
        {% else %}
          <a href="{{ pageNumber | page_url }}">{{ pageNumber }}</a>
        {% endif %}
      {% endfor %}
    </nav>
  {% endif %}
</div>
`

const ORDER_TRACKING = `<div class="tpl-default">
  <section class="d-track">
    <p class="d-eyebrow">Orders</p>
    <h1>Track your order</h1>
    <p>Enter the order number and the email used at checkout.</p>
    {% slot 'orderTracking' %}
  </section>
</div>
`

const CART = `<div class="tpl-default">
  <section class="d-cart">
    <header class="d-cart-head">
      <h1>Your cart</h1>
      <p class="d-cart-count">
        {% if cart.empty %}Nothing here yet.{% else %}{{ cart.item_count }} item{% if cart.item_count != 1 %}s{% endif %}{% endif %}
      </p>
    </header>

    {% if cart.empty %}
      <p class="d-empty">Your cart is empty — the catalogue is one click away.</p>
      <div class="d-cart-empty-actions">
        <a class="d-button" href="{{ routes.products }}">Start shopping</a>
      </div>
    {% else %}
      <div class="d-cart-lines">
        {% for line in cart.items %}
          <div class="d-cart-line">
            <a class="d-cart-media" href="{% if line.url %}{{ line.url }}{% else %}{{ routes.products }}{% endif %}">
              {% if line.image_url %}<img src="{{ line.image_url }}" alt="{{ line.name }}" loading="lazy" />{% endif %}
            </a>
            <div class="d-cart-info">
              <a class="d-cart-name" href="{% if line.url %}{{ line.url }}{% else %}{{ routes.products }}{% endif %}">{{ line.name }}</a>
              {% if line.variant_name %}<span class="d-cart-variant">{{ line.variant_name }}</span>{% endif %}
              <span class="d-cart-price">{{ line.price | money }}</span>
            </div>
            <div class="d-cart-controls">{% slot 'cartLineControls', line: line %}</div>
            <span class="d-cart-line-total">{{ line.line_total | money }}</span>
          </div>
        {% endfor %}
      </div>
    {% endif %}

    {% slot 'cartUnavailable' %}
    {% slot 'cartCheckout' %}
  </section>
</div>
`

const ACCOUNT_NAV = `<nav class="d-account-nav" aria-label="Account">
  {% if active == 'profile' %}<a class="d-account-tab d-account-tab--active" aria-current="page" href="{{ routes.account }}">Profile</a>{% else %}<a class="d-account-tab" href="{{ routes.account }}">Profile</a>{% endif %}
  {% if active == 'orders' %}<a class="d-account-tab d-account-tab--active" aria-current="page" href="{{ routes.account_orders }}">Orders</a>{% else %}<a class="d-account-tab" href="{{ routes.account_orders }}">Orders</a>{% endif %}
  {% if active == 'wishlist' %}<a class="d-account-tab d-account-tab--active" aria-current="page" href="{{ routes.account_wishlist }}">Wishlist</a>{% else %}<a class="d-account-tab" href="{{ routes.account_wishlist }}">Wishlist</a>{% endif %}
  {% if active == 'addresses' %}<a class="d-account-tab d-account-tab--active" aria-current="page" href="{{ routes.account_addresses }}">Addresses</a>{% else %}<a class="d-account-tab" href="{{ routes.account_addresses }}">Addresses</a>{% endif %}
  {% if active == 'rewards' %}<a class="d-account-tab d-account-tab--active" aria-current="page" href="{{ routes.account_rewards }}">Rewards</a>{% else %}<a class="d-account-tab" href="{{ routes.account_rewards }}">Rewards</a>{% endif %}
</nav>
`

const ACCOUNT = `<div class="tpl-default">
  <section class="d-account">
    <header class="d-account-head">
      <p class="d-eyebrow">Account</p>
      <h1>{% if customer.name %}Hello, {{ customer.name }}{% else %}Your account{% endif %}</h1>
    </header>
    {% render 'account-nav', active: 'profile' %}

    <div class="d-account-card">
      <h2>Profile</h2>
      <p class="d-account-note">The name and number the shop uses to reach you. The email is what orders are filed under.</p>
      {% slot 'accountProfile' %}
    </div>

    {% slot 'accountPassword' %}

    <div class="d-account-card">
      <h2>Sign out</h2>
      <p class="d-account-note">Leaving ends this session on this device.</p>
      {% slot 'accountSignOut' %}
    </div>
  </section>
</div>
`

const ACCOUNT_ORDERS = `<div class="tpl-default">
  <section class="d-account">
    <header class="d-account-head">
      <p class="d-eyebrow">Account</p>
      <h1>Your orders</h1>
    </header>
    {% render 'account-nav', active: 'orders' %}

    {% if customer.orders == blank %}
      <p class="d-empty">No orders yet — the catalogue is one click away.</p>
      <div class="d-account-actions">
        <a class="d-button" href="{{ routes.products }}">Start shopping</a>
      </div>
    {% else %}
      <div class="d-orders">
        {% for order in customer.orders %}
          <a class="d-order" href="{{ order.url }}">
            <span class="d-order-main">
              <span class="d-order-number">{{ order.order_number }}</span>
              <span class="d-order-tags">
                {% if order.status_label %}<span class="d-tag">{{ order.status_label }}</span>{% endif %}
                {% if order.payment_label %}<span class="d-tag d-tag--warning">{{ order.payment_label }}</span>{% endif %}
                {% if order.review_pending %}<span class="d-tag d-tag--brand">{{ order.review_label }}</span>{% endif %}
              </span>
              <span class="d-order-meta">{{ order.placed_at_label }} · {{ order.item_count_label }}</span>
            </span>
            <span class="d-order-total">{{ order.total | money }}</span>
          </a>
        {% endfor %}
      </div>
      {% if customer.orders_truncated %}
        <p class="d-account-note">Older orders are on their own pages.</p>
      {% endif %}
    {% endif %}
  </section>
</div>
`

const ACCOUNT_ADDRESSES = `<div class="tpl-default">
  <section class="d-account">
    <header class="d-account-head">
      <p class="d-eyebrow">Account</p>
      <h1>Your addresses</h1>
    </header>
    {% render 'account-nav', active: 'addresses' %}
    {% slot 'accountAddresses' %}
  </section>
</div>
`

const ACCOUNT_REWARDS = `<div class="tpl-default">
  <section class="d-account">
    <header class="d-account-head">
      <p class="d-eyebrow">Account</p>
      <h1>Rewards</h1>
    </header>
    {% render 'account-nav', active: 'rewards' %}

    {% if customer.rewards == blank %}
      <p class="d-empty">This shop has no rewards programme right now.</p>
    {% else %}
      <div class="d-balance">
        <span class="d-balance-label">Points balance</span>
        <span class="d-balance-value">{{ customer.rewards.balance }}</span>
        <span class="d-balance-meta">Lifetime earned: {{ customer.rewards.lifetime_points }}</span>
        {% if customer.rewards.tier %}
          <span class="d-tag d-tag--brand">{{ customer.rewards.tier.name }}</span>
        {% endif %}
        {% if customer.rewards.next_tier %}
          <span class="d-progress"><span class="d-progress-fill" style="width: {{ customer.rewards.next_tier.progress_percent }}%"></span></span>
          <span class="d-balance-meta">{{ customer.rewards.next_tier.points_to_next }} points to {{ customer.rewards.next_tier.name }}</span>
        {% elsif customer.rewards.at_top_tier %}
          <span class="d-balance-meta">Top tier reached — every point still earns.</span>
        {% endif %}
      </div>

      <div class="d-rewards">
        {% for reward in customer.rewards.rewards %}
          <div class="d-reward">
            <span class="d-reward-main">
              <span class="d-reward-name">{{ reward.name }}</span>
              {% if reward.description %}<span class="d-reward-note">{{ reward.description }}</span>{% endif %}
              <span class="d-reward-status">{{ reward.status_label }}</span>
            </span>
            <span class="d-reward-cost">{{ reward.points_cost }} pts</span>
            {% slot 'rewardClaim', reward: reward %}
          </div>
        {% endfor %}
      </div>

      <h2 class="d-account-sub">My codes</h2>
      {% if customer.rewards.claims == blank %}
        <p class="d-account-note">Codes you claim show up here.</p>
      {% else %}
        <div class="d-claims">
          {% for claim in customer.rewards.claims %}
            <div class="d-claim">
              <span class="d-claim-main">
                <span class="d-claim-name">{{ claim.reward_name }}{% if claim.used %} · used{% endif %}</span>
                <span class="d-claim-code">{{ claim.code }}</span>
                <span class="d-claim-meta">{{ claim.redeemed_at_label }} · {{ claim.points }} pts</span>
              </span>
              {% slot 'rewardCopy', claim: claim %}
            </div>
          {% endfor %}
        </div>
      {% endif %}
    {% endif %}
  </section>
</div>
`

const ACCOUNT_WISHLIST = `<div class="tpl-default">
  <section class="d-account">
    <header class="d-account-head">
      <p class="d-eyebrow">Account</p>
      <h1>Your wishlist</h1>
    </header>
    {% render 'account-nav', active: 'wishlist' %}

    {% if customer.wishlist == blank or customer.wishlist.products == blank %}
      <p class="d-empty">Nothing saved yet — the heart on a product keeps it here.</p>
      <div class="d-account-actions">
        <a class="d-button" href="{{ routes.products }}">Browse the catalogue</a>
      </div>
    {% else %}
      <div class="d-wishlist">
        {% for product in customer.wishlist.products %}
          <div class="d-wish">
            <a class="d-card" href="{{ product.url }}">
              <span class="d-card-media">
                {% if product.image_url %}
                  <img src="{{ product.image_url }}" alt="{{ product.name }}" loading="lazy" />
                {% endif %}
                {% if product.on_sale %}<span class="d-badge">Sale</span>{% endif %}
              </span>
              <span class="d-card-name">{{ product.name }}</span>
              <span class="d-card-price">
                {{ product.price | money }}
                {% if product.on_sale %}<s>{{ product.compare_at_price | money }}</s>{% endif %}
              </span>
            </a>
            <div class="d-wish-heart">{% slot 'wishlistToggle', product: product %}</div>
          </div>
        {% endfor %}
      </div>
    {% endif %}
  </section>
</div>
`

const CARD = `<a class="d-card" href="{{ product.url }}">
  <span class="d-card-media">
    {% if product.image_url %}
      <img src="{{ product.image_url }}" alt="{{ product.title }}" loading="lazy" />
    {% endif %}
    {% if product.on_sale %}<span class="d-badge">Sale</span>{% endif %}
  </span>
  <span class="d-card-name">{{ product.title }}</span>
  <span class="d-card-price">
    {{ product.price | money }}
    {% if product.on_sale %}<s>{{ product.compare_at_price | money }}</s>{% endif %}
  </span>
</a>
`

const CSS = `/* The platform's default theme. Scoped under .tpl-default so it never
   touches a shop theme's markup, wherever the default is drawn. */
.tpl-default {
  color: var(--chakra-colors-fg);
  font-family: var(--chakra-fonts-body);
}

.tpl-default a {
  color: inherit;
  text-decoration: none;
}

.tpl-default img {
  display: block;
  max-width: 100%;
}

.d-header {
  align-items: center;
  border-bottom: 1px solid var(--chakra-colors-border);
  display: flex;
  gap: 2rem;
  justify-content: space-between;
  padding: 1rem clamp(1rem, 4vw, 2.5rem);
}

.d-brand {
  align-items: center;
  display: inline-flex;
  font-family: var(--chakra-fonts-heading);
  font-size: 1.3rem;
  font-weight: 700;
  gap: 0.6rem;
}

.d-brand img {
  border-radius: 0.5rem;
  height: 2rem;
  object-fit: cover;
  width: 2rem;
}

.d-nav,
.d-actions {
  display: flex;
  gap: 1.2rem;
  font-size: 0.95rem;
}

.d-nav a,
.d-actions a {
  color: var(--chakra-colors-fg-muted);
}

.d-nav a:hover,
.d-actions a:hover {
  color: var(--chakra-colors-fg);
}

.d-main {
  margin: 0 auto;
  max-width: 1200px;
  padding: 0 clamp(1rem, 4vw, 2.5rem);
}

.d-footer {
  border-top: 1px solid var(--chakra-colors-border);
  color: var(--chakra-colors-fg-muted);
  font-size: 0.9rem;
  margin-top: 4rem;
  padding: 2rem clamp(1rem, 4vw, 2.5rem);
}

.d-footer p {
  margin: 0.2rem 0;
}

.d-footer-name {
  color: var(--chakra-colors-fg);
  font-family: var(--chakra-fonts-heading);
  font-size: 1.1rem;
}

.d-hero {
  align-items: center;
  display: grid;
  gap: 2.5rem;
  padding: clamp(2rem, 5vw, 4rem) 0;
}

@media (min-width: 900px) {
  .d-hero {
    grid-template-columns: 1fr 1fr;
  }
}

.d-hero h1 {
  font-family: var(--chakra-fonts-heading);
  font-size: clamp(2.2rem, 5vw, 3.8rem);
  letter-spacing: -0.02em;
  margin: 0;
}

.d-hero p {
  color: var(--chakra-colors-fg-muted);
  line-height: 1.7;
  margin: 1rem 0 1.5rem;
  max-width: 32rem;
}

.d-hero-image {
  aspect-ratio: 4 / 3;
  border-radius: 1rem;
  object-fit: cover;
  width: 100%;
}

.d-button {
  background: var(--chakra-colors-brand-solid);
  border-radius: 999px;
  color: var(--chakra-colors-brand-contrast);
  display: inline-block;
  font-weight: 600;
  padding: 0.75rem 1.5rem;
}

.d-band {
  padding-top: clamp(2rem, 5vw, 3.5rem);
}

.d-band h2 {
  font-family: var(--chakra-fonts-heading);
  font-size: clamp(1.4rem, 3vw, 2rem);
  margin: 0 0 1.25rem;
}

.d-band-head {
  align-items: baseline;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

.d-see-all {
  border-bottom: 1px solid currentColor;
  font-size: 0.9rem;
}

.d-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, 1fr);
}

@media (min-width: 800px) {
  .d-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (min-width: 700px) {
  .d-grid--articles {
    grid-template-columns: repeat(3, 1fr);
  }
}

.d-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.d-card-media {
  aspect-ratio: 1;
  background: var(--chakra-colors-bg-panel);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 0.9rem;
  overflow: hidden;
  position: relative;
}

.d-card-media img {
  height: 100%;
  object-fit: cover;
  transition: transform 300ms ease;
  width: 100%;
}

.d-card:hover .d-card-media img {
  transform: scale(1.04);
}

.d-badge {
  background: var(--chakra-colors-brand-solid);
  border-radius: 999px;
  color: var(--chakra-colors-brand-contrast);
  font-size: 0.7rem;
  font-weight: 700;
  left: 0.6rem;
  padding: 0.2rem 0.55rem;
  position: absolute;
  text-transform: uppercase;
  top: 0.6rem;
}

.d-card-name {
  font-weight: 600;
  line-height: 1.35;
}

.d-card-meta {
  color: var(--chakra-colors-fg-muted);
  font-size: 0.8rem;
}

.d-card-price,
.d-price {
  align-items: baseline;
  display: flex;
  gap: 0.5rem;
}

.d-card-price s,
.d-price s {
  color: var(--chakra-colors-fg-muted);
}

.d-product {
  display: grid;
  gap: 2.5rem;
  padding-top: 2rem;
}

@media (min-width: 900px) {
  .d-product {
    grid-template-columns: 1.1fr 1fr;
  }
}

.d-gallery {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 1fr 1fr;
}

.d-gallery img {
  aspect-ratio: 1;
  border-radius: 0.9rem;
  object-fit: cover;
  width: 100%;
}

.d-product-info {
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.d-product-info h1 {
  font-family: var(--chakra-fonts-heading);
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  margin: 0;
}

.d-eyebrow {
  color: var(--chakra-colors-brand-fg);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.d-rating {
  color: var(--chakra-colors-fg-muted);
  font-size: 0.9rem;
  margin: 0;
}

.d-price {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.d-sold-out {
  color: var(--chakra-colors-danger-fg);
  font-weight: 600;
}

.d-description {
  color: var(--chakra-colors-fg-muted);
  line-height: 1.75;
  white-space: pre-line;
}

.d-slot {
  margin-top: 0.5rem;
}

.d-listing-head {
  padding-top: clamp(2rem, 4vw, 3rem);
}

.d-listing-head h1 {
  font-family: var(--chakra-fonts-heading);
  font-size: clamp(1.9rem, 4vw, 3rem);
  margin: 0;
}

.d-listing-head p {
  color: var(--chakra-colors-fg-muted);
  line-height: 1.7;
  margin: 0.8rem 0 0;
  max-width: 42rem;
}

.d-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

.d-chip {
  border: 1px solid var(--chakra-colors-border);
  border-radius: 999px;
  color: var(--chakra-colors-fg-muted);
  font-size: 0.85rem;
  padding: 0.4rem 0.9rem;
}

.d-chip:hover,
.d-chip--active {
  border-color: var(--chakra-colors-fg);
  color: var(--chakra-colors-fg);
}

.d-count {
  color: var(--chakra-colors-fg-muted);
  font-size: 0.85rem;
  margin: 2rem 0 1rem;
}

.d-empty {
  color: var(--chakra-colors-fg-muted);
  padding: 2.5rem 0;
  text-align: center;
}

.d-search {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1.5rem;
}

.d-search-input {
  background: var(--chakra-colors-bg-panel);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 999px;
  color: var(--chakra-colors-fg);
  font: inherit;
  min-width: 16rem;
  padding: 0.75rem 1.2rem;
}

.d-pager {
  align-items: center;
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  padding-top: 2.5rem;
}

.d-pager a,
.d-pager span {
  border: 1px solid var(--chakra-colors-border);
  border-radius: 0.6rem;
  font-size: 0.9rem;
  min-width: 2.4rem;
  padding: 0.45rem 0.7rem;
  text-align: center;
}

.d-pager-current {
  background: var(--chakra-colors-fg);
  border-color: var(--chakra-colors-fg);
  color: var(--chakra-colors-bg);
  font-weight: 600;
}

.d-article {
  margin: 0 auto;
  max-width: 46rem;
  padding-top: clamp(2rem, 5vw, 3.5rem);
}

.d-article h1 {
  font-family: var(--chakra-fonts-heading);
  font-size: clamp(2rem, 5vw, 3.2rem);
  line-height: 1.1;
  margin: 0.5rem 0 0;
}

.d-article-meta {
  color: var(--chakra-colors-fg-muted);
  font-size: 0.88rem;
  margin-top: 0.9rem;
}

.d-article-cover {
  aspect-ratio: 16 / 9;
  border-radius: 1.25rem;
  margin-top: 2rem;
  object-fit: cover;
  width: 100%;
}

.d-article-body {
  font-size: 1.05rem;
  line-height: 1.85;
  padding-top: 2.5rem;
}

.d-track {
  margin: 0 auto;
  max-width: 34rem;
  padding-top: clamp(2rem, 5vw, 3.5rem);
}

.d-track h1 {
  font-family: var(--chakra-fonts-heading);
  font-size: clamp(1.9rem, 4vw, 2.6rem);
  margin: 0.5rem 0 0;
}

.d-track p {
  color: var(--chakra-colors-fg-muted);
  line-height: 1.7;
  margin: 0.8rem 0 1.5rem;
}

.d-cart {
  margin: 0 auto;
  max-width: 72rem;
  padding-top: clamp(2rem, 5vw, 3.5rem);
}

.d-cart-head {
  align-items: baseline;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  justify-content: space-between;
}

.d-cart-head h1 {
  font-family: var(--chakra-fonts-heading);
  font-size: clamp(1.9rem, 4vw, 2.6rem);
  letter-spacing: -0.02em;
  margin: 0;
}

.d-cart-count {
  color: var(--chakra-colors-fg-muted);
  font-size: 0.9rem;
  margin: 0;
}

.d-cart-empty-actions {
  padding-top: 0.5rem;
  text-align: center;
}

.d-cart-lines {
  background: var(--chakra-colors-bg-panel);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 1rem;
  overflow: hidden;
}

.d-cart-line {
  align-items: center;
  border-bottom: 1px solid var(--chakra-colors-border);
  display: flex;
  gap: 1rem;
  padding: 1rem;
}

.d-cart-line:last-child {
  border-bottom: 0;
}

.d-cart-media {
  background: var(--chakra-colors-bg-muted);
  border-radius: 0.6rem;
  flex: none;
  height: 4rem;
  overflow: hidden;
  width: 4rem;
}

.d-cart-media img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.d-cart-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.d-cart-name {
  font-weight: 600;
}

.d-cart-variant,
.d-cart-price {
  color: var(--chakra-colors-fg-muted);
  font-size: 0.85rem;
}

.d-cart-controls {
  flex: none;
}

.d-cart-line-total {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  min-width: 4.5rem;
  text-align: right;
}

.d-account {
  margin: 0 auto;
  max-width: 48rem;
  padding-top: clamp(2rem, 5vw, 3.5rem);
}

.d-account-head h1 {
  font-family: var(--chakra-fonts-heading);
  font-size: clamp(1.9rem, 4vw, 2.6rem);
  letter-spacing: -0.02em;
  margin: 0.2rem 0 1.5rem;
}

.d-account-nav {
  border-bottom: 1px solid var(--chakra-colors-border);
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
  overflow-x: auto;
}

.d-account-tab {
  border-bottom: 2px solid transparent;
  color: var(--chakra-colors-fg-muted);
  flex: none;
  font-size: 0.9rem;
  font-weight: 500;
  margin-bottom: -1px;
  padding: 0.6rem 0.75rem;
  white-space: nowrap;
}

.d-account-tab--active {
  border-color: var(--chakra-colors-brand-solid);
  color: var(--chakra-colors-fg);
}

.d-account-card {
  background: var(--chakra-colors-bg-panel);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 1rem;
  margin-bottom: 1.25rem;
  padding: 1.25rem;
}

.d-account-card h2,
.d-account-sub {
  font-family: var(--chakra-fonts-heading);
  font-size: 1.05rem;
  margin: 0 0 0.35rem;
}

.d-account-sub {
  margin-top: 2rem;
}

.d-account-note,
.d-account-meta {
  color: var(--chakra-colors-fg-muted);
  font-size: 0.85rem;
  margin: 0 0 0.75rem;
}

.d-account-actions {
  padding-top: 0.5rem;
  text-align: center;
}

.d-orders {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.d-order {
  align-items: center;
  background: var(--chakra-colors-bg-panel);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 1rem;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  padding: 1rem;
}

.d-order-main {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.d-order-number {
  font-weight: 600;
}

.d-order-tags,
.d-order-tags * {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.d-order-meta {
  color: var(--chakra-colors-fg-muted);
  font-size: 0.8rem;
}

.d-order-total {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  white-space: nowrap;
}

.d-tag {
  background: var(--chakra-colors-bg-muted);
  border-radius: 999px;
  color: var(--chakra-colors-fg-muted);
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.15rem 0.6rem;
}

.d-tag--warning {
  background: var(--chakra-colors-orange-subtle);
  color: var(--chakra-colors-orange-fg);
}

.d-tag--brand {
  background: var(--chakra-colors-brand-subtle);
  color: var(--chakra-colors-brand-fg);
}

.d-balance {
  background: var(--chakra-colors-bg-panel);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1.25rem;
  padding: 1.25rem;
}

.d-balance-label {
  color: var(--chakra-colors-fg-muted);
  font-size: 0.8rem;
}

.d-balance-value {
  font-size: 2rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 1.1;
}

.d-balance-meta {
  color: var(--chakra-colors-fg-subtle);
  font-size: 0.8rem;
}

.d-progress {
  background: var(--chakra-colors-bg-muted);
  border-radius: 999px;
  height: 0.4rem;
  margin-top: 0.4rem;
  overflow: hidden;
  width: 100%;
}

.d-progress-fill {
  background: var(--chakra-colors-brand-solid);
  display: block;
  height: 100%;
}

.d-rewards,
.d-claims {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.d-reward,
.d-claim {
  align-items: center;
  background: var(--chakra-colors-bg-panel);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 1rem;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  padding: 1rem;
}

.d-reward-main,
.d-claim-main {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.d-reward-name,
.d-claim-name {
  font-weight: 600;
}

.d-reward-note {
  color: var(--chakra-colors-fg-muted);
  font-size: 0.8rem;
}

.d-reward-status,
.d-claim-meta {
  color: var(--chakra-colors-fg-subtle);
  font-size: 0.75rem;
}

.d-reward-cost {
  color: var(--chakra-colors-brand-solid);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  white-space: nowrap;
}

.d-claim-code {
  font-family: var(--chakra-fonts-mono);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.d-wishlist {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
}

.d-wish {
  position: relative;
}

.d-wish .d-card {
  height: 100%;
}

.d-wish-heart {
  position: absolute;
  right: 0.5rem;
  top: 0.5rem;
}
`

/** Every file of the platform's default theme, by theme-relative path. */
export function defaultThemeFiles(): ThemeFiles {
  return {
    'layout/theme.tpl': LAYOUT,
    'templates/index.tpl': HOME,
    'templates/product.tpl': PRODUCT,
    'templates/catalog.tpl': CATALOG,
    'templates/search.tpl': SEARCH,
    'templates/page.tpl': PAGE,
    'templates/article.tpl': ARTICLE,
    'templates/blog.tpl': BLOG,
    'templates/order-tracking.tpl': ORDER_TRACKING,
    'templates/cart.tpl': CART,
    'templates/account.tpl': ACCOUNT,
    'templates/account-orders.tpl': ACCOUNT_ORDERS,
    'templates/account-addresses.tpl': ACCOUNT_ADDRESSES,
    'templates/account-rewards.tpl': ACCOUNT_REWARDS,
    'templates/account-wishlist.tpl': ACCOUNT_WISHLIST,
    'snippets/account-nav.tpl': ACCOUNT_NAV,
    'snippets/product-card.tpl': CARD,
    'assets/theme.css': CSS,
  }
}
