package com.email.assistant.app;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

@Service
public class EmailGeneratorService {

    private final WebClient webClient;

    @Value("${gemini.api.url}")
    private String geminiAPIUrl;

    @Value("${gemini.api.key}")
    private String geminiAPIKey;

    public EmailGeneratorService(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build(); //This will be injected at runtime by Spring (builds an object of webClient)
    }

    public String generateEmailReply(EmailRequest emailRequest){

        //Build the prompt (will be the input to the packet)
        String prompt = buildPrompt(emailRequest);

        // Craft a request (Note that the request has to be apsed in a certain manner ---> Can't just dump it
            //Have to follow the contents ---> part ---> text sequence (embedded as KVP's, hence the Map)
        Map<String, Object> requestBody = Map.of(
                "contents", new Object[] { // Within context is the new Object described below (a map of parts which leads to a map of text
                        Map.of("parts", new Object[] {
                                Map.of("text", prompt)
                        })
                }
        );


        //Do the request and get response (we will make use of WebClient ---> Lets us handle asynchronous non-blocking HTTP requests
        String response = webClient.post()
                .uri(geminiAPIUrl + geminiAPIKey)
                .header("Content-Type", "application/json")
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .block();

        // Extract the context of the response and return it (have to parse through the way the call gets returned to get the actual text that the AI generated as a response to the Email
        return extractResponseContent(response);
    }

    private String extractResponseContent(String response) {
        try {
            ObjectMapper mapper = new ObjectMapper(); // Tool from the Jackson library that helps to work with JSON data easier (converts JSON reads and writes into Java objects)
            JsonNode rootNode = mapper.readTree(response); // Will need to iterate though JSON response (readTree will turn the JSON response into a tree like structure)
            // This allows us to go though the contents like a tree below to get the email response text that the API returns
            return rootNode.path("candidates")
                    .get(0)
                    .path("content")
                    .path("parts")
                    .get(0)
                    .path("text")
                    .asText();
        }catch (Exception e){
            return "Error processing request: " + e.getMessage();
        }
    }


    private String buildPrompt(EmailRequest emailRequest) {
        StringBuilder prompt = new StringBuilder(); //Empty StringBuilder Object
        prompt.append("Generate a professional email reply for the following email content. Do not generate a subject line ");
        if (emailRequest.getTone() != null && !emailRequest.getTone().isEmpty()) { // If a tone is specified
            prompt.append("Use a ").append(emailRequest.getTone()).append(" tone."); // Tell the AI to use it when creating the response
        }
        prompt.append("\nOriginal Email: \n").append(emailRequest.getEmailContent());
        return prompt.toString();
    }
}
