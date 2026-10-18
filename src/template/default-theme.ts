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
        <a class="d-chip{% if listing.current == blank %} d-chip--active{% endif %}" href="{{ routes.products }}">All</a>
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
        <a class="d-chip{% if blog.tag == blank %} d-chip--active{% endif %}" href="{{ blog.url }}">All</a>
        {% for tag in blog.tags limit: 12 %}
          <a class="d-chip{% if tag == blog.tag %} d-chip--active{% endif %}" href="{{ blog.url }}?tag={{ tag | url_encode }}">
            #{{ tag }}
          </a>
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
    'snippets/product-card.tpl': CARD,
    'assets/theme.css': CSS,
  }
}
