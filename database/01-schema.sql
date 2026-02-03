DROP TABLE IF EXISTS not_interested;
DROP TABLE IF EXISTS order_item;
DROP TABLE IF EXISTS "order";
DROP TABLE IF EXISTS review;
DROP TABLE IF EXISTS wishlist;
DROP TABLE IF EXISTS product;
DROP TABLE IF EXISTS seller;
DROP TABLE IF EXISTS customer;


-- customer TABLE
CREATE TABLE customer (
  customer_id INT PRIMARY KEY,
  customer_email TEXT UNIQUE
);

-- SELLER TABLE
CREATE TABLE seller (
  seller_id INT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- PRODUCT TABLE
CREATE TABLE product (
  product_id INT PRIMARY KEY,
  image_url TEXT,
  name TEXT,
  price NUMERIC(10,2)
);

-- WISHLIST TABLE
CREATE TABLE wishlist (
  customer_id INT NOT NULL REFERENCES customer(customer_id),
  product_id INT NOT NULL REFERENCES product(product_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (customer_id, product_id)
);

-- REVIEW TABLE
CREATE TABLE review (
  review_id INT PRIMARY KEY,
  product_id INT NOT NULL REFERENCES product(product_id),
  customer_id INT NOT NULL REFERENCES customer(customer_id),
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE "order" (
  order_id INT PRIMARY KEY,
  customer_id INT NOT NULL,
  ordered_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE order_item (
  order_id INT NOT NULL REFERENCES "order"(order_id),
  product_id INT NOT NULL REFERENCES product(product_id),
  quantity INT NOT NULL DEFAULT 1,
  PRIMARY KEY (order_id, product_id)
);

CREATE TABLE not_interested (
  customer_id INT NOT NULL REFERENCES customer(customer_id),
  product_id INT NOT NULL REFERENCES product(product_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (customer_id, product_id)
);