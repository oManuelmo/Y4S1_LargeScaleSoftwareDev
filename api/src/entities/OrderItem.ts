import { Entity, Column, ManyToOne, PrimaryColumn, JoinColumn } from "typeorm";
import { Order } from "./Order";

@Entity({ name: "order_item" })
export class OrderItem {
  @PrimaryColumn({ name: "order_id", type: "int" })
  order_id!: number;

  @PrimaryColumn({ name: "product_id", type: "int" })
  product_id!: number;

  @ManyToOne(() => Order, order => order.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "order_id" })
  order!: Order;

  @Column({ name: "quantity", type: "int", default: 1 })
  quantity!: number;
}
