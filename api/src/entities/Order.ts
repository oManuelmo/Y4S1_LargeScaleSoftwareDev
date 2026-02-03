import { Entity, Column, PrimaryColumn, OneToMany } from "typeorm";
import { OrderItem } from "./OrderItem";

@Entity({ name: "order" })
export class Order {
  @PrimaryColumn({ name: "order_id", type: "int" })
  order_id!: number;

  @Column({ name: "customer_id", type: "int" })
  customer_id!: number;

  @Column({ name: "ordered_at", type: "timestamptz" })
  ordered_at!: Date;
  
  @OneToMany(() => OrderItem, item => item.order, { cascade: true })
  items!: OrderItem[];
}
