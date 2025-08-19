import { validateUserIdentity } from "@/lib/server/api"
import { checkUsageByModel } from "@/lib/usage"
import { generateUUID } from "@/lib/utils/uuid"

type CreateChatInput = {
  userId: string
  title?: string
  model: string
  isAuthenticated: boolean
  projectId?: string
}

export async function createChatInDb({
  userId,
  title,
  model,
  isAuthenticated,
  projectId,
}: CreateChatInput) {
  const supabase = await validateUserIdentity(userId, isAuthenticated)
  if (!supabase) {
    return {
      id: generateUUID(),
      user_id: userId,
      title,
      model,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  await checkUsageByModel(supabase, userId, model, isAuthenticated)

  // Try with model column first, fallback if it doesn't exist
  let insertData: {
    user_id: string
    title: string
    model?: string
    project_id?: string
  } = {
    user_id: userId,
    title: title || "New Chat",
    model,
  }

  if (projectId) {
    insertData.project_id = projectId
  }

  let { data, error } = await supabase
    .from("chats")
    .insert(insertData)
    .select("*")
    .single()

  // If model column doesn't exist, try without it
  if (error && error.message.includes("model")) {
    console.log("Model column doesn't exist, trying without it...")
    insertData = {
      user_id: userId,
      title: title || "New Chat",
    }
    
    if (projectId) {
      insertData.project_id = projectId
    }
    
    const result = await supabase
      .from("chats")
      .insert(insertData)
      .select("*")
      .single()
    
    data = result.data
    error = result.error
    
    // Add the model to the returned data manually since it's not in the DB
    if (data) {
      data.model = model
    }
  }

  if (error || !data) {
    console.error("Error creating chat:", error)
    // Return fallback chat object if database fails
    return {
      id: generateUUID(),
      user_id: userId,
      title: title || "New Chat",
      model,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  return data
}
