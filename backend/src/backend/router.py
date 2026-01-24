from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Any
from backend.models import InferenceResponse, ParticipantDetailsResponse, TimelineResponse, ModelsResponse, ParticipantInferencesResponse

router = APIRouter(prefix="/v1")

inference_service: Optional[Any] = None


def set_inference_service(service):
    global inference_service
    inference_service = service


@router.get("/hello")
def hello():
    return {"message": "hello"}


@router.get("/inference/current", response_model=InferenceResponse)
async def get_current_inference_stats(reload: bool = False):
    if inference_service is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        return await inference_service.get_current_epoch_stats(reload=reload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch current epoch stats: {str(e)}")


@router.get("/inference/epochs/{epoch_id}", response_model=InferenceResponse)
async def get_epoch_inference_stats(epoch_id: int, height: Optional[int] = None):
    if inference_service is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    if epoch_id < 1:
        raise HTTPException(status_code=400, detail="Invalid epoch ID")
    
    if height is not None and height < 1:
        raise HTTPException(status_code=400, detail="Invalid height")
    
    try:
        return await inference_service.get_historical_epoch_stats(epoch_id, height=height)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch epoch {epoch_id} stats: {str(e)}")


@router.get("/participants/{participant_id}", response_model=ParticipantDetailsResponse)
async def get_participant_details(
    participant_id: str,
    epoch_id: int = Query(..., description="Epoch ID (required)"),
    height: Optional[int] = Query(None, description="Block height (optional)")
):
    if inference_service is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    if epoch_id < 1:
        raise HTTPException(status_code=400, detail="Invalid epoch ID")
    
    if height is not None and height < 1:
        raise HTTPException(status_code=400, detail="Invalid height")
    
    try:
        details = await inference_service.get_participant_details(
            participant_id=participant_id,
            epoch_id=epoch_id,
            height=height
        )
        
        if details is None:
            raise HTTPException(
                status_code=404,
                detail=f"Participant {participant_id} not found in epoch {epoch_id}"
            )
        
        return details
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch participant details: {str(e)}"
        )


@router.get("/timeline", response_model=TimelineResponse)
async def get_timeline():
    if inference_service is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        return await inference_service.get_timeline()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch timeline: {str(e)}")


@router.get("/models/current", response_model=ModelsResponse)
async def get_current_models():
    if inference_service is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        return await inference_service.get_current_models()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch current models: {str(e)}")


@router.get("/models/epochs/{epoch_id}", response_model=ModelsResponse)
async def get_historical_models(epoch_id: int, height: Optional[int] = None):
    if inference_service is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    if epoch_id < 1:
        raise HTTPException(status_code=400, detail="Invalid epoch ID")
    
    if height is not None and height < 1:
        raise HTTPException(status_code=400, detail="Invalid height")
    
    try:
        return await inference_service.get_historical_models(epoch_id, height)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch models for epoch {epoch_id}: {str(e)}")


@router.get("/participants/{participant_id}/inferences", response_model=ParticipantInferencesResponse)
async def get_participant_inferences(
    participant_id: str,
    epoch_id: int = Query(..., description="Epoch ID (required)")
):
    if inference_service is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    if epoch_id < 1:
        raise HTTPException(status_code=400, detail="Invalid epoch ID")
    
    try:
        inferences = await inference_service.get_participant_inferences_summary(
            epoch_id=epoch_id,
            participant_id=participant_id
        )
        return inferences
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch inferences: {str(e)}"
        )


@router.post("/test/alert")
async def test_alert():
    from backend.email_alert import EmailAlert
    from backend.webhook_alert import WebhookAlert
    
    email_alert = EmailAlert()
    webhook_alert = WebhookAlert()
    
    subject = "Test Alert: Block Height Growth Stagnation"
    message = (
        "This is a test alert to verify the notification system is working.\n\n"
        "Current block height: TEST\n"
        "Last growth detected: TEST seconds ago\n"
        "Timestamp: TEST"
    )
    
    results = {}
    
    if email_alert.enabled:
        results["email"] = await email_alert.send_alert(subject, message)
    else:
        results["email"] = "not configured"
    
    if webhook_alert.enabled:
        results["webhook"] = await webhook_alert.send_alert(subject, message)
    else:
        results["webhook"] = "not configured"
    
    return {
        "message": "Test alert sent",
        "results": results
    }


@router.get("/test/block-height-status")
async def get_block_height_status():
    if inference_service is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        current_height = await inference_service.client.get_latest_height()
        return {
            "current_height": current_height,
            "monitoring_active": True,
            "note": "Check logs for 'Block height increased' or 'Block height unchanged' messages to see monitoring activity"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get block height: {str(e)}")


@router.post("/test/simulate-block-stagnation")
async def simulate_block_stagnation():
    """Simulate block stagnation by fixing the height at current value for testing"""
    import backend.app as app_module
    
    if app_module.inference_service_instance is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        current_height = await app_module.inference_service_instance.client.get_latest_height()
        
        app_module.block_height_test_mode = True
        app_module.block_height_test_fixed_height = current_height
        
        return {
            "message": f"Block stagnation simulation enabled. Height fixed at {current_height}",
            "fixed_height": current_height,
            "note": "Monitoring will now see the same height repeatedly, triggering alert after threshold. Use POST /v1/test/disable-block-stagnation to disable."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to simulate stagnation: {str(e)}")


@router.post("/test/disable-block-stagnation")
async def disable_block_stagnation():
    """Disable block stagnation simulation"""
    import backend.app as app_module
    
    app_module.block_height_test_mode = False
    app_module.block_height_test_fixed_height = None
    
    return {
        "message": "Block stagnation simulation disabled. Monitoring will use real block heights.",
        "test_mode": False
    }

