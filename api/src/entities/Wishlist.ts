import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Customer } from "./Customer";
import { Product } from "./Product";

@Entity({ name: "wishlist" })
export class Wishlist {
  @PrimaryColumn({ name: "product_id", type: "int" })
  product_id!: number;

  @PrimaryColumn({ name: "customer_id", type: "int" })
  customer_id!: number;

  @ManyToOne(() => Customer, customer => customer.wishlist)
  @JoinColumn({ name: "customer_id" })
  customer!: Customer;

  @ManyToOne(() => Product, product => product.wishlist)
  @JoinColumn({ name: "product_id" })
  product!: Product;

  @Column({ name: "created_at", type: "timestamp", nullable: true, default: () => "CURRENT_TIMESTAMP" })
  created_at?: Date;
}