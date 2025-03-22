import re
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from handle_link import get_youtube_captions
from summary import get_summary
import re

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain instead of *
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
active_connections = {}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # Send connection confirmation
    await websocket.send_json({"status": "connected", "message": "WebSocket connection established"})
    
    # Generate a unique ID for this connection
    connection_id = id(websocket)
    active_connections[connection_id] = websocket
    
    try:
        while True:
            # Wait for data from the client
            data = await websocket.receive_text()
            
            # Check if it's a URL or a chat message
            try:
                # Try to parse as JSON to see if it's a chat message
                message_data = json.loads(data)
                
                if message_data.get("type") == "chat":
                    # Handle chat message
                    prompt = message_data.get("message", "")
                    context = message_data.get("context", "")
                    
                    # Generate response using conversation.py's client
                    from conversation import client
                    
                    chat_prompt = f"""
                    Context: This is a conversation about a YouTube video. 
                    The transcript of the video is:
                    {context}
                    
                    User question: {prompt}
                    
                    Please respond to the user's question based on the video transcript. 
                    If the answer is not in the transcript, just say so politely.
                    """
                    
                    response = client.models.generate_content(
                        model="gemini-2.0-flash",
                        contents=chat_prompt
                    )
                    
                    await websocket.send_json({
                        "status": "success",
                        "type": "chat_response",
                        "message": response.text
                    })
                    
            except json.JSONDecodeError:
                # Process as URL if not JSON
                url = data
                
                # Get captions
                result = get_youtube_captions(url)
                
                if result["status"] == "success":
                    transcript = result["transcript"]
                    
                    # Generate summary
                    summary = get_summary(transcript)
                    
                    # Send both transcript and summary
                    await websocket.send_json({
                        "status": "success",
                        "transcript": transcript,
                        "summary": summary
                    })
                else:
                    # If there was an error getting captions, forward that error
                    await websocket.send_json(result)
            except Exception as e:
                await websocket.send_json({"status": "error", "message": f"Server error: {str(e)}"})
    except WebSocketDisconnect:
        # Remove connection when disconnected
        if connection_id in active_connections:
            del active_connections[connection_id]
    except Exception as e:
        # Handle any other exceptions
        try:
            await websocket.send_json({"status": "error", "message": f"Unexpected error: {str(e)}"})
        except:
            pass
        # Remove connection on error
        if connection_id in active_connections:
            del active_connections[connection_id]

@app.get("/")
async def root():
    return {"message": "YouWin API is running. Connect via WebSocket at /ws"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
