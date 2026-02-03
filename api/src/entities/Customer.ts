import { Entity, Column, Unique, PrimaryColumn, OneToMany } from "typeorm";
import { Wishlist } from "./Wishlist";
import { NotInterested } from "./NotInterested";

@Entity({ name: "customer" })
@Unique(["customer_email"])
export class Customer {
  @PrimaryColumn({ name: "customer_id", type: "int" })
  customer_id!: number;

  @Column({ name: "customer_email", type: "text", nullable: true })
  customer_email?: string;

  @OneToMany(() => Wishlist, wishlist => wishlist.customer)
  wishlist!: Wishlist[];

  @OneToMany(() => NotInterested, notInterested => notInterested.customer)
  not_interested!: NotInterested[];
}