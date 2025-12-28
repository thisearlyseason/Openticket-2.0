import express from "express"
import cors from "cors"
import "dotenv/config"
import { createClient } from "@supabase/supabase-js"

const app = express()
app.use(cors())
app.use(express.json())

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

app.post("/create-order", async (req, res) => {
  const { userId, ticketId, quantity } = req.body

  const { data: ticket } = await supabase
    .from("tickets")
    .select("inventory")
    .eq("id", ticketId)
    .single()

  if (!ticket || ticket.inventory < quantity) {
    return res.status(400).json({ error: "Not enough tickets" })
  }

  await supabase
    .from("tickets")
    .update({ inventory: ticket.inventory - quantity })
    .eq("id", ticketId)

  const { data: order } = await supabase
    .from("orders")
    .insert({ user_id: userId })
    .select()
    .single()

  await supabase
    .from("order_items")
    .insert({
      order_id: order.id,
      ticket_id: ticketId,
      quantity
    })

  res.json({ success: true, orderId: order.id })
})

app.listen(8080, () => {
  console.log("API running on port 8080")
})
