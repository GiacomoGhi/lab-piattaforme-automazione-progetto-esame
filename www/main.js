function setSemaphoreColor(color){
    const light1=document.getElementById("SemaphoreLight1");
    const light2=document.getElementById("SemaphoreLight2");
    const light3=document.getElementById("SemaphoreLight3");
    if(color=="red"){
        light1.className="SemaphoreRed";
        light2.className="SemaphoreOff";
        light3.className="SemaphoreOff";
    }else if(color=="yellow"){
        light1.className="SemaphoreOff";
        light2.className="SemaphoreYellow";
        light3.className="SemaphoreOff";
    }else if(color=="green"){
        light1.className="SemaphoreOff";
        light2.className="SemaphoreOff";
        light3.className="SemaphoreGreen";
    }else{
        light1.className="SemaphoreRed";
        light2.className="SemaphoreOff";
        light3.className="SemaphoreOff";
    }
}

function setCounterValue(count){
    const counterDiv=document.getElementById("CounterValue");
    counterDiv.innerText=`${count}`;
}

function wait(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setStatus(status){
    const statusDiv=document.getElementById("Status");
    statusDiv.innerText=`Status: ${status}`;
}

async function poll(){
    while(true){
        await wait(1000);
        try{
            console.log("Polling status...");
            let response=await fetch("http://localhost:8080/counter");
            response=await fetch("http://localhost:8080/counter");
            setStatus("Connected")
            response= await fetch("http://localhost:8080/counter/properties/count");
            const currCounterValue= parseInt(await response.json());
            setCounterValue(currCounterValue)
            response= await fetch("http://localhost:8080/semaphore/properties/color");
            const currSemaphoreColor= `${await response.json()}`;
            setSemaphoreColor(currSemaphoreColor)

        }catch(e){
            console.log(e)
            setSemaphoreColor("red")
            setCounterValue(0)
            setStatus("Disconnected")
        }
    }
}


poll();