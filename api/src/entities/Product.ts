import { Entity, Column, PrimaryColumn, OneToMany } from "typeorm";
import { Wishlist } from "./Wishlist";
import { NotInterested } from "./NotInterested";

@Entity({ name: "product" })
export class Product {
  @PrimaryColumn({ name: "product_id", type: "int", generated: false })
  product_id!: number;

  @Column({ name: "image_url", type: "text", nullable: true })
  image_url?: string;

  @Column({ name: "name", type: "text", nullable: true })
  name?: string;

  @Column({ name: "price", type: "numeric", precision: 10, scale: 2, nullable: true })
  price?: number;

  @OneToMany(() => Wishlist, wishlist => wishlist.product)
  wishlist!: Wishlist[];

  @OneToMany(() => NotInterested, notInterested => notInterested.product)
  not_interested!: NotInterested[];
}