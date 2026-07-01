import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const discounts = await prisma.discount.findMany({
    include: { discountProducts: true }
  })
  console.log(JSON.stringify(discounts, null, 2))
}
main()
