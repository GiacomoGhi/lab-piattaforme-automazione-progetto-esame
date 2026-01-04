# Exercise: Semaphore Counter - Orchestrator (2025-12-02)
## Overview
In this exercise, you will implement a simple orchestrator for two Things:
- Counter Thing – maintains a numeric count and allows incrementing it.
- Semaphore Thing – maintains a color that can be set to "red", "yellow", or "green".
Your orchestrator will connect these Things and update the semaphore color according to the counter value.


## Step 1: Define the Thing Descriptions (TDs)
Create the TDs for the Counter and Semaphore Things, following these rules:
**Counter Thing**
- Property: "count" → integer
- Action: "increment" → increases the count by 1  
Example endpoint for the count property:  
http://localhost:8080/counter/properties/count  

**Semaphore Thing**
- Property: "color" → string with accepted values: "red", "yellow", "green"
- Action: "setColor" → sets the color  
Example endpoint for the color property:  
http://localhost:8080/semaphore/properties/color  

>> After creating the TDs, instantiate the two Things in the provided src/main.ts file.


## Step 2: Implement the Orchestrator
In src/main.ts:
1. Consume the two Things remotely.
2. Update the semaphore color based on the counter value using these thresholds:  

- count ≥ 10 -> semaphore color: green  
- count ≥ 5 and < 10 -> semaphore color: yellow  
- count < 5 -> semaphore color: red

3. You can use either **polling** or **subscription-based** mechanisms to observe changes in the counter and update the semaphore.  
4. Ensure that all constraints from Step 1 are respected.


## Step 3: Run and Verify

1. Start the orchestrator:
```npm run start:dev```
or build and start manually.  
2. Open **index.html** file in the exercise folder on a browser and verify that the webpage displays “connected”.
3. Increment the counter (via script or Postman) and check that the semaphore color updates correctly on the webpage.

## Notes
- Make sure the orchestrator does not modify the internal logic of the Things; all intelligence should be in the orchestration code.
- Keep the TDs and the orchestrator consistent with the example code.
- The exposed things can be handled directly in the main function of src/main.ts or defined in a separate class. The latter is clearer and easier to handle, but in a simple case like this both are viable options