import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from "typeorm";
import { Customer } from "./Customer";
import { Product } from "./Product";

@Entity({ name: "not_interested" })
export class NotInterested {
  @PrimaryColumn({ name: "product_id", type: "int" })
  product_id!: number;

  @PrimaryColumn({ name: "customer_id", type: "int" })
  customer_id!: number;

  @ManyToOne(() => Customer, customer => customer.not_interested)
  @JoinColumn({ name: "customer_id" })
  customer!: Customer;

  @ManyToOne(() => Product, product => product.not_interested)
  @JoinColumn({ name: "product_id" })
  product!: Product;

  @Column({ type: "timestamptz", name: "created_at", default: () => "CURRENT_TIMESTAMP" })
  created_at!: Date;
}