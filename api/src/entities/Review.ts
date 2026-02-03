import { Entity, Column, PrimaryColumn } from "typeorm";

@Entity({ name: "review" })
export class Review {
  @PrimaryColumn({ name: "review_id", type: "int" })
  review_id!: number;

  @Column({ name: "product_id", type: "int" })
  product_id!: number;

  @Column({ name: "customer_id", type: "int" })
  customer_id!: number;

  @Column({ name: "rating", type: "int" })
  rating!: number;

  @Column({ name: "reviewed_at", type: "timestamptz" })
  reviewed_at!: Date;
}